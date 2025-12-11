import {Logger,Crawler, Parser, Indexer, SearchEngine, PersistenceManager, ParsedDocument, CrawledTweet, CrawledUser, CrawledHashtag} from '../controllers/SearchEngine';
import { Router, Request, Response } from 'express';

import tweetService from '@/application/services/tweets';
import prisma from "../../database";
import { MessageStatus } from "@prisma/client";


export function apiRoutes(
  crawler: Crawler,
  parser: Parser,
  indexer: Indexer,
  searchEngine: SearchEngine,
  persistence: PersistenceManager
) {
  const router = Router();
  const logger = new Logger('API');

  // Health check
  router.get('/health', (req: Request, res: Response) => {
    const stats = indexer.getIndexStats();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      index: stats
    });
  });

  // ===== INDEXING ENDPOINTS =====

  router.post('/index/tweets', async (req: Request, res: Response) => {
    try {
      const { limit = 100, offset = 0 } = req.body;
      logger.info(`Indexing tweets: limit=${limit}, offset=${offset}`);
      
      const tweets = await crawler.crawlTweets(limit, offset);
      const parsedDocs = tweets.map(tweet => parser.parseTweet(tweet));
      indexer.indexMultiple(parsedDocs);

      res.json({
        message: `Successfully indexed ${parsedDocs.length} tweets`,
        count: parsedDocs.length,
        stats: indexer.getIndexStats()
      });
    } catch (error) {
      logger.error('Failed to index tweets', error);
      res.status(500).json({ error: 'Failed to index tweets', details: String(error) });
    }
  });

  router.post('/index/users', async (req: Request, res: Response) => {
    try {
      const { limit = 100, offset = 0 } = req.body;
      logger.info(`Indexing users: limit=${limit}, offset=${offset}`);
      
      const users = await crawler.crawlUsers(limit, offset);
      const parsedDocs = users.map(user => parser.parseUser(user));
      indexer.indexMultiple(parsedDocs);

      res.json({
        message: `Successfully indexed ${parsedDocs.length} users`,
        count: parsedDocs.length,
        stats: indexer.getIndexStats()
      });
    } catch (error) {
      logger.error('Failed to index users', error);
      res.status(500).json({ error: 'Failed to index users', details: String(error) });
    }
  });

  router.post('/index/hashtags', async (req: Request, res: Response) => {
    try {
      const { limit = 100, offset = 0 } = req.body;
      logger.info(`Indexing hashtags: limit=${limit}, offset=${offset}`);
      
      const hashtags = await crawler.crawlHashtags(limit, offset);
      const parsedDocs = hashtags.map(hashtag => parser.parseHashtag(hashtag));
      indexer.indexMultiple(parsedDocs);

      res.json({
        message: `Successfully indexed ${parsedDocs.length} hashtags`,
        count: parsedDocs.length,
        stats: indexer.getIndexStats()
      });
    } catch (error) {
      logger.error('Failed to index hashtags', error);
      res.status(500).json({ error: 'Failed to index hashtags', details: String(error) });
    }
  });

  router.post('/index/batch', async (req: Request, res: Response) => {
    try {
      const { type = 'tweets', limit = 5000 } = req.body;
      logger.info(`Starting batch indexing: type=${type}, limit=${limit}`);
      
      let data: any = [];
      if (type === 'tweets') {
        data = await crawler.crawlInBatches('tweets', limit);
      } else if (type === 'users') {
        data = await crawler.crawlInBatches('users', limit);
      } else if (type === 'hashtags') {
        data = await crawler.crawlInBatches('hashtags', limit);
      }

      let parsedDocs: ParsedDocument[] = [];
      if (type === 'tweets') {
        parsedDocs = data.map((t: CrawledTweet) => parser.parseTweet(t));
      } else if (type === 'users') {
        parsedDocs = data.map((u: CrawledUser) => parser.parseUser(u));
      } else if (type === 'hashtags') {
        parsedDocs = data.map((h: CrawledHashtag) => parser.parseHashtag(h));
      }

      indexer.indexMultiple(parsedDocs);
      await persistence.saveIndex(indexer.getIndexStats(), 'search_index');

      res.json({
        message: `Successfully batch indexed ${parsedDocs.length} ${type}`,
        count: parsedDocs.length,
        stats: indexer.getIndexStats()
      });
    } catch (error) {
      logger.error('Failed to batch index', error);
      res.status(500).json({ error: 'Failed to batch index', details: String(error) });
    }
  });

  router.post('/index/all', async (req: Request, res: Response) => {
    try {
      const { limit = 100 } = req.body;
      logger.info(`Indexing all data: limit=${limit}`);
      
      const [tweets, users, hashtags] = await crawler.crawlAll();
      
      const parsedTweets = tweets.slice(0, limit).map(t => parser.parseTweet(t));
      const parsedUsers = users.slice(0, limit).map(u => parser.parseUser(u));
      const parsedHashtags = hashtags.slice(0, limit).map(h => parser.parseHashtag(h));
      
      indexer.indexMultiple([...parsedTweets, ...parsedUsers, ...parsedHashtags]);
      await persistence.saveIndex(indexer.getIndexStats(), 'search_index');

      res.json({
        message: 'Successfully indexed all data',
        counts: {
          tweets: parsedTweets.length,
          users: parsedUsers.length,
          hashtags: parsedHashtags.length
        },
        stats: indexer.getIndexStats()
      });
    } catch (error) {
      logger.error('Failed to index all data', error);
      res.status(500).json({ error: 'Failed to index all data', details: String(error) });
    }
  });

  // ===== SEARCH ENDPOINTS =====

  router.get('/search', (req: Request, res: Response) => {
    try {
      const { 
        q, 
        limit = '20', 
        offset = '0', 
        type = 'all',
        fuzzy = 'false',
        phrase = 'false'
      } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      const searchLimit = Math.min(parseInt(limit as string, 10) || 20, 100);
      const searchOffset = Math.max(parseInt(offset as string, 10) || 0, 0);
      const useFuzzy = fuzzy === 'true';
      const usePhrase = phrase === 'true';

      logger.info(`Search: q="${q}" type="${type}" limit=${searchLimit} offset=${searchOffset}`);

      const results = searchEngine.search(q, {
        limit: searchLimit,
        offset: searchOffset,
        type: type as any || 'all',
        useFuzzy,
        usePhrase
      });

      res.json(results);
    } catch (error) {
      logger.error('Search failed', error);
      res.status(500).json({ error: 'Search failed', details: String(error) });
    }
  });

  router.get('/search/:type', (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      const { q, limit = '20', offset = '0', fuzzy = 'false', phrase = 'false' } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      if (!['tweet', 'user', 'hashtag', 'url'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be: tweet, user, hashtag, or url' });
      }

      const searchLimit = Math.min(parseInt(limit as string, 10) || 20, 100);
      const searchOffset = Math.max(parseInt(offset as string, 10) || 0, 0);
      const useFuzzy = fuzzy === 'true';
      const usePhrase = phrase === 'true';

      logger.info(`Search by type: q="${q}" type="${type}" limit=${searchLimit}`);

      const results = searchEngine.searchByType(q, type as any, searchLimit, searchOffset);

      res.json(results);
    } catch (error) {
      logger.error('Search by type failed', error);
      res.status(500).json({ error: 'Search by type failed', details: String(error) });
    }
  });

  // ===== STATS & INFO ENDPOINTS =====

  router.get('/stats', (req: Request, res: Response) => {
    try {
      const stats = indexer.getIndexStats();
      res.json({
        ...stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get stats', error);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  router.get('/documents', (req: Request, res: Response) => {
    try {
      const { type, limit = '100' } = req.query;
      
      let documents: ParsedDocument[];
      if (type && ['tweet', 'user', 'hashtag', 'url'].includes(type as string)) {
        documents = indexer.getDocumentsByType(type as any);
      } else {
        documents = Array.from(indexer.getDocuments().values());
      }

      const docLimit = Math.min(parseInt(limit as string, 10) || 100, 1000);
      const sliced = documents.slice(0, docLimit);

      res.json({
        total: documents.length,
        returned: sliced.length,
        type: type || 'all',
        documents: sliced.map(doc => ({
          id: doc.id,
          type: doc.type,
          tokensCount: doc.tokens.length,
          timestamp: new Date(doc.timestamp).toISOString(),
          data: doc.data
        }))
      });
    } catch (error) {
      logger.error('Failed to get documents', error);
      res.status(500).json({ error: 'Failed to get documents' });
    }
  });

  router.get('/terms', (req: Request, res: Response) => {
    try {
      const { limit = '50', type = 'all' } = req.query;
      const invertedIndex = indexer.getInvertedIndex();
      const docFreq = indexer.getDocumentFrequency();

      const terms = Object.entries(docFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, Math.min(parseInt(limit as string, 10) || 50, 500))
        .map(([term, frequency]) => ({
          term,
          frequency,
          documentCount: invertedIndex[term]?.size || 0
        }));

      res.json({
        total: Object.keys(docFreq).length,
        returned: terms.length,
        terms
      });
    } catch (error) {
      logger.error('Failed to get terms', error);
      res.status(500).json({ error: 'Failed to get terms' });
    }
  });

  // ===== PERSISTENCE ENDPOINTS =====

  router.post('/index/save', async (req: Request, res: Response) => {
    try {
      const success = await persistence.saveIndex(indexer.getIndexStats(), 'search_index');
      if (success) {
        res.json({ message: 'Index saved to Redis successfully' });
      } else {
        res.status(500).json({ error: 'Failed to save index' });
      }
    } catch (error) {
      logger.error('Failed to save index', error);
      res.status(500).json({ error: 'Failed to save index', details: String(error) });
    }
  });

  router.post('/index/load', async (req: Request, res: Response) => {
    try {
      const data = await persistence.loadIndex('search_index');
      if (data) {
        res.json({ message: 'Index loaded from Redis', data });
      } else {
        res.status(404).json({ error: 'Index not found in Redis' });
      }
    } catch (error) {
      logger.error('Failed to load index', error);
      res.status(500).json({ error: 'Failed to load index', details: String(error) });
    }
  });

  // ===== MANAGEMENT ENDPOINTS =====

  router.delete('/index/clear', (req: Request, res: Response) => {
    try {
      indexer.clear();
      logger.info('Index cleared');
      res.json({ message: 'Index cleared successfully', stats: indexer.getIndexStats() });
    } catch (error) {
      logger.error('Failed to clear index', error);
      res.status(500).json({ error: 'Failed to clear index' });
    }
  });

  router.post('/crawl', async (req: Request, res: Response) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    try {
      const crawledData = await crawler.crawlUrl(url);
      if (!crawledData) {
        return res.status(400).json({ error: 'Failed to crawl URL' });
      }

      const parsedDoc = parser.parseUrl(crawledData);
      indexer.index(parsedDoc);

      res.json({
        message: 'URL crawled and indexed successfully',
        documentId: parsedDoc.id,
        url: parsedDoc.url,
        title: parsedDoc.title,
        tokensCount: parsedDoc.tokens.length
      });
    } catch (error) {
      logger.error('Failed to crawl URL', error);
      res.status(500).json({ error: 'Failed to crawl and index URL', details: String(error) });
    }
  });

  router.post('/crawl/batch', async (req: Request, res: Response) => {
    const { urls } = req.body;
    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ error: 'URLs array is required' });
    }

    try {
      const crawledData = await crawler.crawlMultiple(urls);
      const parsedDocs = parser.parseMultiple(crawledData);
      indexer.indexMultiple(parsedDocs);

      res.json({
        message: 'URLs crawled and indexed successfully',
        count: parsedDocs.length,
        documents: parsedDocs.map(doc => ({
          id: doc.id,
          url: doc.url,
          title: doc.title,
          type: doc.type,
          tokensCount: doc.tokens.length
        })),
        stats: indexer.getIndexStats()
      });
    } catch (error) {
      logger.error('Failed to batch crawl URLs', error);
      res.status(500).json({ error: 'Failed to crawl and index URLs', details: String(error) });
    }
  });

  return router;
}


export function twitterSearchRoutes() {
  const router = Router();
  const logger = new Logger('TwitterSearch');

  // ===========================
  // HELPER FUNCTIONS
  // ===========================

  const calculateEngagementScore = (tweet: any) => {
    const likesWeight = 1;
    const retweetsWeight = 2;
    const repliesWeight = 1.5;
    const quotesWeight = 2;

    const engagementScore =
      (tweet.likesCount || 0) * likesWeight +
      (tweet.retweetCount || 0) * retweetsWeight +
      (tweet.repliesCount || 0) * repliesWeight +
      (tweet.quotesCount || 0) * quotesWeight;

    // Time decay factor (newer tweets get boost)
    const hoursSinceCreation =
      (Date.now() - new Date(tweet.createdAt).getTime()) / (1000 * 60 * 60);
    const timeFactor = 1 / Math.log10(hoursSinceCreation + 2);

    return engagementScore * timeFactor;
  };

  const calculateUserRelevanceScore = (user: any, query: string) => {
    let score = 0;
    const lowerQuery = query.toLowerCase();
    
    // Exact username match gets highest score
    if (user.username.toLowerCase() === lowerQuery) {
      score += 1000;
    } else if (user.username.toLowerCase().startsWith(lowerQuery)) {
      score += 500;
    } else if (user.username.toLowerCase().includes(lowerQuery)) {
      score += 100;
    }
    
    // Name match
    if (user.name?.toLowerCase().includes(lowerQuery)) {
      score += 50;
    }
    
    // Verified users get boost
    if (user.verified) {
      score += 200;
    }
    
    // Followers count boost
    score += (user._count?.followers || 0) * 0.01;
    
    return score;
  };

  // ===========================
  // 1. TOP - Mixed results (Tweets + Users like X)
  // ===========================
  router.get('/search/top', async (req: Request, res: Response) => {
    try {
      const {
        q = '',
        cursor = null,
        userId,
      } = req.query;

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      logger.info(`Top search: q="${q}"`);

      // Search tweets
      const tweets = await prisma.tweet.findMany({
        where: {
          OR: [
            { content: { contains: q as string, mode: 'insensitive' } },
            {
              hashtags: {
                some: {
                  hash: {
                    tag_text: { contains: q as string, mode: 'insensitive' },
                  },
                },
              },
            },
          ],
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          likesCount: true,
          repliesCount: true,
          quotesCount: true,
          retweetCount: true,
          replyControl: true,
          tweetType: true,
          parentId: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              profileMedia: { select: { id: true } },
              protectedAccount: true,
              verified: true,
            },
          },
          tweetLikes: {
            where: { userId: userId as string },
            select: { userId: true },
          },
          retweets: {
            where: { userId: userId as string },
            select: { userId: true },
          },
          tweetBookmark: {
            where: { userId: userId as string },
            select: { userId: true },
          },
          tweetMedia: {
            select: {
              mediaId: true,
              media: {
                select: {
                  id: true,
                  type: true,
                },
              },
            },
          },
        },
        take: 50, // Fetch more for scoring
      });

      // Search users
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: q as string, mode: 'insensitive' } },
            { name: { contains: q as string, mode: 'insensitive' } },
            { bio: { contains: q as string, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          username: true,
          bio: true,
          verified: true,
          protectedAccount: true,
          profileMedia: { select: { id: true } },
          coverMedia: { select: { id: true } },
          _count: {
            select: {
              followers: true,
              followings: true,
              tweet: true,
            },
          },
          followers: {
            where: { followerId: userId as string },
            select: { followerId: true },
          },
        },
        take: 10,
      });

      // Score and sort tweets
      const scoredTweets = tweets
        .map(({tweet}:any) => ({
          ...tweet,
          score: calculateEngagementScore(tweet),
          isLiked: tweet.tweetLikes.length > 0,
          isRetweeted: tweet.retweets.length > 0,
          isBookmarked: tweet.tweetBookmark.length > 0,
          type: 'tweet' as const,
        }))
        .sort(({a, b}:any) => b.score - a.score)
        .slice(0, 20);

      // Score and sort users
      const scoredUsers = users
        .map((user: any) => ({
          ...user,
          score: calculateUserRelevanceScore(user, q as string),
          followersCount: user._count?.followers || 0,
          followingsCount: user._count?.followings || 0,
          tweetsCount: user._count?.tweet || 0,
          isFollowing: (user.followers && user.followers.length > 0) || false,
          type: 'user' as const,
        }))
        .sort(({a, b}:any) => b.score - a.score)
        .slice(0, 3); // Top 3 users like X

      // Remove internal fields
      const cleanedUsers = scoredUsers.map(({ score, _count, followers, ...user }: any) => user);
      const cleanedTweets = scoredTweets.map(({ score, tweetLikes, retweets, tweetBookmark, ...tweet }: any) => tweet);

      res.json({
        query: q,
        type: 'top',
        users: cleanedUsers,
        tweets: cleanedTweets,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Top search failed', error);
      res.status(500).json({ error: 'Search failed', details: String(error) });
    }
  });

  // ===========================
  // 2. LATEST - Chronological tweets only
  // ===========================
  router.get('/search/latest', async (req: Request, res: Response) => {
    try {
      const {
        q = '',
        limit = '20',
        cursor = null,
        userId,
      } = req.query;

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      const searchLimit = Math.min(parseInt(limit as string, 10) || 20, 100);

      logger.info(`Latest search: q="${q}" limit=${searchLimit}`);

      const tweets = await prisma.tweet.findMany({
        where: {
          OR: [
            { content: { contains: q as string, mode: 'insensitive' } },
            {
              hashtags: {
                some: {
                  hash: {
                    tag_text: { contains: q as string, mode: 'insensitive' },
                  },
                },
              },
            },
          ],
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          likesCount: true,
          repliesCount: true,
          quotesCount: true,
          retweetCount: true,
          replyControl: true,
          tweetType: true,
          parentId: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              profileMedia: { select: { id: true } },
              protectedAccount: true,
              verified: true,
            },
          },
          tweetLikes: {
            where: { userId: userId as string },
            select: { userId: true },
          },
          retweets: {
            where: { userId: userId as string },
            select: { userId: true },
          },
          tweetBookmark: {
            where: { userId: userId as string },
            select: { userId: true },
          },
          tweetMedia: {
            select: {
              mediaId: true,
              media: {
                select: {
                  id: true,
                  type: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: searchLimit + 1,
        ...(cursor && { cursor: { id: cursor as string }, skip: 1 }),
      });

      const hasNextPage = tweets.length > searchLimit;
      const results = hasNextPage ? tweets.slice(0, -1) : tweets;

      const tweetsWithInteractions = results.map((tweet: any) => ({
        ...tweet,
        isLiked: tweet.tweetLikes.length > 0,
        isRetweeted: tweet.retweets.length > 0,
        isBookmarked: tweet.tweetBookmark.length > 0,
      }));

      // Remove internal fields
      const cleanedTweets = tweetsWithInteractions.map(({ tweetLikes, retweets, tweetBookmark, ...tweet }: any) => tweet);

      res.json({
        query: q,
        type: 'latest',
        results: cleanedTweets,
        total: results.length,
        cursor: hasNextPage ? results[results.length - 1].id : null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Latest search failed', error);
      res.status(500).json({ error: 'Search failed', details: String(error) });
    }
  });

  // ===========================
  // 3. PEOPLE - Users only
  // ===========================
  router.get('/search/people', async (req: Request, res: Response) => {
    try {
      const {
        q = '',
        limit = '20',
        cursor = null,
        userId,
      } = req.query;

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      const searchLimit = Math.min(parseInt(limit as string, 10) || 20, 100);

      logger.info(`People search: q="${q}" limit=${searchLimit}`);

      const users = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: q as string, mode: 'insensitive' } },
            { name: { contains: q as string, mode: 'insensitive' } },
            { bio: { contains: q as string, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          username: true,
          bio: true,
          verified: true,
          protectedAccount: true,
          profileMedia: { select: { id: true } },
          coverMedia: { select: { id: true } },
         
          _count: {
            select: {
              followers: true,
              followings: true,
              tweet: true,
            },
          },
          followers: {
            where: { followerId: userId as string },
            select: { followerId: true },
          },
        },
        take: searchLimit + 1,
        ...(cursor && { cursor: { id: cursor as string }, skip: 1 }),
      });

      // Score users by relevance
      const scoredUsers = users.map((user: any) => ({
        ...user,
        score: calculateUserRelevanceScore(user, q as string),
      }));

      scoredUsers.sort(({a, b}: any) => b.score - a.score);

      const hasNextPage = scoredUsers.length > searchLimit;
      const results = hasNextPage ? scoredUsers.slice(0, -1) : scoredUsers;

      const usersWithFollowStatus = results.map(({ score, _count, followers, ...user }: any) => ({
        ...user,
        followersCount: _count?.followers || 0,
        followingsCount: _count?.followings || 0,
        tweetsCount: _count?.tweet || 0,
        isFollowing: followers && followers.length > 0,
      }));

      res.json({
        query: q,
        type: 'people',
        results: usersWithFollowStatus,
        total: results.length,
        cursor: hasNextPage ? results[results.length - 1].id : null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('People search failed', error);
      res.status(500).json({ error: 'Search failed', details: String(error) });
    }
  });

  // ===========================
  // 4. MEDIA - Tweets with media (Photos/Videos)
  // ===========================
  router.get('/search/media', async (req: Request, res: Response) => {
    try {
      const {
        q = '',
        limit = '20',
        cursor = null,
        userId,
      } = req.query;

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      const searchLimit = Math.min(parseInt(limit as string, 10) || 20, 100);

      logger.info(`Media search: q="${q}" limit=${searchLimit}`);

      const tweets = await prisma.tweet.findMany({
        where: {
          AND: [
            {
              OR: [
                { content: { contains: q as string, mode: 'insensitive' } },
                {
                  hashtags: {
                    some: {
                      hash: {
                        tag_text: { contains: q as string, mode: 'insensitive' },
                      },
                    },
                  },
                },
              ],
            },
            {
              tweetMedia: {
                some: {}, // Must have at least one media
              },
            },
          ],
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          likesCount: true,
          repliesCount: true,
          quotesCount: true,
          retweetCount: true,
          replyControl: true,
          tweetType: true,
          parentId: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              profileMedia: { select: { id: true } },
              protectedAccount: true,
              verified: true,
            },
          },
          tweetLikes: {
            where: { userId: userId as string },
            select: { userId: true },
          },
          retweets: {
            where: { userId: userId as string },
            select: { userId: true },
          },
          tweetBookmark: {
            where: { userId: userId as string },
            select: { userId: true },
          },
          tweetMedia: {
            select: {
              mediaId: true,
              media: {
                select: {
                  id: true,
                  type: true,
                  
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: searchLimit + 1,
        ...(cursor && { cursor: { id: cursor as string }, skip: 1 }),
      });

      const hasNextPage = tweets.length > searchLimit;
      const results = hasNextPage ? tweets.slice(0, -1) : tweets;

      const tweetsWithInteractions = results.map((tweet: any) => ({
        ...tweet,
        isLiked: tweet.tweetLikes.length > 0,
        isRetweeted: tweet.retweets.length > 0,
        isBookmarked: tweet.tweetBookmark.length > 0,
      }));

      // Remove internal fields
      const cleanedTweets = tweetsWithInteractions.map(({ tweetLikes, retweets, tweetBookmark, ...tweet }: any) => tweet);

      res.json({
        query: q,
        type: 'media',
        results: cleanedTweets,
        total: results.length,
        cursor: hasNextPage ? results[results.length - 1].id : null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Media search failed', error);
      res.status(500).json({ error: 'Search failed', details: String(error) });
    }
  });

  // ===========================
  // 5. LISTS - Search communities/groups (like X screenshot)
  // ===========================
//   router.get('/search/lists', async (req: Request, res: Response) => {
//     try {
//       const {
//         q = '',
//         limit = '20',
//         cursor = null,
//         userId,
//       } = req.query;

//       if (!userId) {
//         return res.status(401).json({ error: 'User ID required' });
//       }

//       const searchLimit = Math.min(parseInt(limit as string, 10) || 20, 100);

//       logger.info(`Lists search: q="${q}" limit=${searchLimit}`);

//       // Check if Community/List model exists
//       try {
//         const communities = await prisma.community.findMany({
//           where: {
//             OR: [
//               { name: { contains: q as string, mode: 'insensitive' } },
//               { description: { contains: q as string, mode: 'insensitive' } },
//             ],
//           },
//           select: {
//             id: true,
//             name: true,
//             description: true,
//             bannerImage: true,
//             avatarImage: true,
//             isPrivate: true,
//             createdAt: true,
//             creatorId: true,
//             creator: {
//               select: {
//                 id: true,
//                 name: true,
//                 username: true,
//                 profileMedia: { select: { id: true } },
//                 verified: true,
//               },
//             },
//             _count: {
//               select: {
//                 members: true,
//                 followers: true,
//               },
//             },
//             // Get some member profile pictures (first 3)
//             members: {
//               take: 3,
//               select: {
//                 user: {
//                   select: {
//                     id: true,
//                     username: true,
//                     profileMedia: { select: { id: true } },
//                   },
//                 },
//               },
//             },
//             // Check if current user is a member
//             followers: {
//               where: { userId: userId as string },
//               select: { userId: true },
//             },
//           },
//           orderBy: [
//             { _count: { members: 'desc' } }, // Most members first
//             { createdAt: 'desc' },
//           ],
//           take: searchLimit + 1,
//           ...(cursor && { cursor: { id: cursor as string }, skip: 1 }),
//         });

//         const hasNextPage = communities.length > searchLimit;
//         const results = hasNextPage ? communities.slice(0, -1) : communities;

//         const communitiesWithDetails = results.map((community: any) => ({
//           id: community.id,
//           name: community.name,
//           description: community.description,
//           bannerImage: community.bannerImage,
//           avatarImage: community.avatarImage,
//           isPrivate: community.isPrivate,
//           createdAt: community.createdAt,
//           membersCount: community._count?.members || 0,
//           followersCount: community._count?.followers || 0,
//           // Profile pictures of some members for display
//           memberPreviews: community.members?.map((m: any) => ({
//             id: m.user.id,
//             username: m.user.username,
//             profileMedia: m.user.profileMedia,
//           })) || [],
//           creator: community.creator,
//           isJoined: community.followers && community.followers.length > 0,
//           isMember: community.followers && community.followers.length > 0,
//         }));

//         res.json({
//           query: q,
//           type: 'lists',
//           results: communitiesWithDetails,
//           total: results.length,
//           cursor: hasNextPage ? results[results.length - 1].id : null,
//           timestamp: new Date().toISOString(),
//         });
//       } catch (communityError: any) {
//         // If Community model doesn't exist, try List model as fallback
//         try {
//           const lists = await prisma.list.findMany({
//             where: {
//               OR: [
//                 { name: { contains: q as string, mode: 'insensitive' } },
//                 { description: { contains: q as string, mode: 'insensitive' } },
//               ],
//             },
//             select: {
//               id: true,
//               name: true,
//               description: true,
//               isPrivate: true,
//               createdAt: true,
//               userId: true,
//               _count: {
//                 select: {
//                   members: true,
//                 },
//               },
//               members: {
//                 take: 3,
//                 select: {
//                   user: {
//                     select: {
//                       id: true,
//                       username: true,
//                       profileMedia: { select: { id: true } },
//                     },
//                   },
//                 },
//               },
//             },
//             orderBy: [
//               { _count: { members: 'desc' } },
//               { createdAt: 'desc' },
//             ],
//             take: searchLimit + 1,
//             ...(cursor && { cursor: { id: cursor as string }, skip: 1 }),
//           });

//           const hasNextPage = lists.length > searchLimit;
//           const results = hasNextPage ? lists.slice(0, -1) : lists;

//           const listsWithDetails = results.map((list: any) => ({
//             id: list.id,
//             name: list.name,
//             description: list.description,
//             isPrivate: list.isPrivate,
//             createdAt: list.createdAt,
//             membersCount: list._count?.members || 0,
//             memberPreviews: list.members?.map((m: any) => ({
//               id: m.user.id,
//               username: m.user.username,
//               profileMedia: m.user.profileMedia,
//             })) || [],
//           }));

//           res.json({
//             query: q,
//             type: 'lists',
//             results: listsWithDetails,
//             total: results.length,
//             cursor: hasNextPage ? results[results.length - 1].id : null,
//             timestamp: new Date().toISOString(),
//           });
//         } catch (listError: any) {
//           // Neither Community nor List model exists
//           logger.warn('Community/List model not found in schema');
//           res.json({
//             query: q,
//             type: 'lists',
//             results: [],
//             total: 0,
//             cursor: null,
//             timestamp: new Date().toISOString(),
//             message: 'Communities/Lists feature not available - Model not found in database schema',
//           });
//         }
//       }
//     } catch (error) {
//       logger.error('Lists search failed', error);
//       res.status(500).json({ 
//         error: 'Search failed', 
//         details: String(error),
//         query: req.query.q || '',
//         type: 'lists',
//         results: [],
//       });
//     }
//   });

//   return router;
// }
}



export function chatSearchRoutes() {
  const router = Router();
  const logger = new Logger('ChatSearch');

  // ===========================
  // HELPER FUNCTIONS
  // ===========================

  const calculateUserRelevanceScore = (user: any, query: string, currentUserId: string) => {
    let score = 0;
    const lowerQuery = query.toLowerCase();
    
    // Exact username match gets highest score
    if (user.username.toLowerCase() === lowerQuery) {
      score += 1000;
    } else if (user.username.toLowerCase().startsWith(lowerQuery)) {
      score += 500;
    } else if (user.username.toLowerCase().includes(lowerQuery)) {
      score += 100;
    }
    
    // Name match
    if (user.name?.toLowerCase().includes(lowerQuery)) {
      score += 50;
    }
    
    // Verified users get boost
    if (user.verified) {
      score += 200;
    }
    
    // Existing conversation with this user gets boost
    if (user.hasExistingConversation) {
      score += 300;
    }
    
    // Recent message activity boost
    if (user.lastMessageAt) {
      const hoursSinceLastMessage = 
        (Date.now() - new Date(user.lastMessageAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastMessage < 24) {
        score += 150;
      } else if (hoursSinceLastMessage < 168) { // Within a week
        score += 75;
      }
    }
    
    // Followers/Following boost
    if (user.isFollowing) {
      score += 100;
    }
    if (user.isFollower) {
      score += 50;
    }
    
    return score;
  };

  // ===========================
  // SEARCH PEOPLE TO CHAT WITH
  // ===========================
  router.get('/chat/search', async (req: Request, res: Response) => {
    try {
      const {
        q = '',
        limit = '20',
        cursor = null,
        userId,
      } = req.query;

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      const searchLimit = Math.min(parseInt(limit as string, 10) || 20, 50);

      logger.info(`Chat search: q="${q}" limit=${searchLimit} userId=${userId}`);

      // Get existing conversations to boost those users
      const existingConversations = await prisma.chat.findMany({
        where: {
          chatUsers: {
            some: { userId: userId as string },
          },
        },
        select: {
          id: true,
          chatUsers: {
            where: { userId: { not: userId as string } },
            select: { userId: true },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      });

      const existingConversationUserIds = new Set(
        existingConversations.flatMap(conv => 
          conv.chatUsers.map(p => p.userId)
        )
      );

      const conversationLastMessageMap = new Map(
        existingConversations.map(conv => {
          const otherUserId = conv.chatUsers[0]?.userId;
          const lastMessageAt = conv.messages[0]?.createdAt;
          return [otherUserId, lastMessageAt];
        })
      );

      // Search users
      const users = await prisma.user.findMany({
        where: {
          AND: [
            {
              OR: [
                { username: { contains: q as string, mode: 'insensitive' } },
                { name: { contains: q as string, mode: 'insensitive' } },
              ],
            },
            // Don't include current user
            { id: { not: userId as string } },
            // Don't include blocked users
            {
              AND: [
                { blocked: { none: { blockerId: userId as string } } },
                { blockers: { none: { blockedId: userId as string } } },
              ],
            },
          ],
        },
        select: {
          id: true,
          name: true,
          username: true,
          bio: true,
          verified: true,
          protectedAccount: true,
          profileMedia: { select: { id: true } },
          // Check if following each other
          followers: {
            where: { followerId: userId as string },
            select: { followerId: true },
          },
          followings: {
            where: { followingId: userId as string },
            select: { followingId: true },
          },
          _count: {
            select: {
              followers: true,
            },
          },
        },
        take: searchLimit + 1,
        ...(cursor && { cursor: { id: cursor as string }, skip: 1 }),
      });

      // Score and enrich users
      const enrichedUsers = users.map((user: any) => {
        const hasExistingConversation = existingConversationUserIds.has(user.id);
        const lastMessageAt = conversationLastMessageMap.get(user.id);
        
        return {
          ...user,
          hasExistingConversation,
          lastMessageAt,
          isFollowing: user.followers && user.followers.length > 0,
          isFollower: user.followings && user.followings.length > 0,
          score: calculateUserRelevanceScore(
            {
              ...user,
              hasExistingConversation,
              lastMessageAt,
              isFollowing: user.followers && user.followers.length > 0,
              isFollower: user.followings && user.followings.length > 0,
            },
            q as string,
            userId as string
          ),
        };
      });

      // Sort by relevance score
      enrichedUsers.sort((a, b) => b.score - a.score);

      const hasNextPage = enrichedUsers.length > searchLimit;
      const results = hasNextPage ? enrichedUsers.slice(0, -1) : enrichedUsers;

      // Clean up response
      const cleanedUsers = results.map(({ score, followers, followings, _count, ...user }: any) => ({
        ...user,
        followersCount: _count?.followers || 0,
      }));

      res.json({
        query: q,
        results: cleanedUsers,
        total: results.length,
        cursor: hasNextPage ? results[results.length - 1].id : null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Chat search failed', error);
      res.status(500).json({ error: 'Search failed', details: String(error) });
    }
  });

  // ===========================
  // GET RECENT CONVERSATIONS
  // ===========================
  router.get('/chat/recent', async (req: Request, res: Response) => {
    try {
      const {
        limit = '20',
        cursor = null,
        userId,
      } = req.query;

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      const searchLimit = Math.min(parseInt(limit as string, 10) || 20, 50);

      logger.info(`Recent conversations: limit=${searchLimit} userId=${userId}`);

      const conversations = await prisma.chat.findMany({
        where: {
          chatUsers: {
            some: { userId: userId as string },
          },
        },
        select: {
          id: true,
          createdAt: true,
          chatUsers: {
            where: { userId: { not: userId as string } },
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  verified: true,
                  profileMedia: { select: { id: true } },
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              content: true,
              createdAt: true,
              userId: true,
              status: true,
            },
          },
          _count: {
            select: {
              messages: {
                where: {
                  AND: [
                    { userId: { not: userId as string } },
                    { status: MessageStatus.SENT },
                  ],
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: searchLimit + 1,
        ...(cursor && { cursor: { id: cursor as string }, skip: 1 }),
      });

      const hasNextPage = conversations.length > searchLimit;
      const results = hasNextPage ? conversations.slice(0, -1) : conversations;

      const formattedConversations = results.map((conv: any) => {
        const otherUser = conv.participants[0]?.user;
        const lastMessage = conv.messages[0];
        const unreadCount = conv._count?.messages || 0;

        return {
          conversationId: conv.id,
          user: otherUser,
          lastMessage: lastMessage ? {
            id: lastMessage.id,
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            isSentByMe: lastMessage.senderId === userId,
            isRead: lastMessage.isRead,
          } : null,
          unreadCount,
          createdAt: conv.createdAt,
        };
      });

      res.json({
        results: formattedConversations,
        total: results.length,
        cursor: hasNextPage ? results[results.length - 1].id : null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to get recent conversations', error);
      res.status(500).json({ error: 'Failed to get conversations', details: String(error) });
    }
  });

  // ===========================
  // GET OR CREATE CONVERSATION
  // ===========================
//   router.post('/chat/conversation', async (req: Request, res: Response) => {
//     try {
//       const { userId, otherUserId } = req.body;

//       if (!userId || !otherUserId) {
//         return res.status(400).json({ error: 'userId and otherUserId required' });
//       }

//       logger.info(`Get/Create conversation: user=${userId} other=${otherUserId}`);

//       // Check if conversation already exists
//       const existingConversation = await prisma.chat.findFirst({
//         where: {
//           AND: [
//             { chatUsers: { some: { userId } } },
//             { chatUsers: { some: { userId: otherUserId } } },
//           ],
//         },
//         select: {
//           id: true,
//           chatUsers: {
//             where: { userId: otherUserId },
//             select: {
//               user: {
//                 select: {
//                   id: true,
//                   name: true,
//                   username: true,
//                   verified: true,
//                   profileMedia: { select: { id: true } },
//                 },
//               },
//             },
//           },
//         },
//       });

//       if (existingConversation) {
//         return res.json({
//           conversationId: existingConversation.id,
//           user: existingConversation.chatUsers[0]?.user,
//           isNew: false,
//         });
//       }

//       // Create new conversation
//       const newConversation = await prisma.chat.create({
//         data: {
//           chatUsers: {
//             create: [
//               { userId },
//               { userId: otherUserId },
//             ],
//           },
//         },
//         select: {
//           id: true,
//           chatUsers: {
//             where: { userId: otherUserId },
//             select: {
//               user: {
//                 select: {
//                   id: true,
//                   name: true,
//                   username: true,
//                   verified: true,
//                   profileMedia: { select: { id: true } },
//                 },
//               },
//             },
//           },
//         },
//       });

//       res.json({
//         conversationId: newConversation.id,
//         user: newConversation.Message[0]?.user,
//         isNew: true,
//       });
//     } catch (error) {
//       logger.error('Failed to get/create conversation', error);
//       res.status(500).json({ error: 'Failed to process conversation', details: String(error) });
//     }
//   });

//   return router;
// }

}
export default {twitterSearchRoutes,chatSearchRoutes};