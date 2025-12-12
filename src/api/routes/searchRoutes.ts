import {ChatParser,ChatCrawler,CrawledConversation,CrawledMessage,ChatSearchEngine,Logger,Crawler, Parser, Indexer, SearchEngine, PersistenceManager, ParsedDocument, CrawledTweet, CrawledUser, CrawledHashtag} from '../controllers/SearchEngine';
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

  // router.get('/search', (req: Request, res: Response) => {
  //   try {
  //     const { 
  //       q, 
  //       limit = '20', 
  //       offset = '0', 
  //       type = 'all',
  //       fuzzy = 'false',
  //       phrase = 'false'
  //     } = req.query;
      
  //     if (!q || typeof q !== 'string') {
  //       return res.status(400).json({ error: 'Query parameter "q" is required' });
  //     }

  //     const searchLimit = Math.min(parseInt(limit as string, 10) || 20, 100);
  //     const searchOffset = Math.max(parseInt(offset as string, 10) || 0, 0);
  //     const useFuzzy = fuzzy === 'true';
  //     const usePhrase = phrase === 'true';

  //     logger.info(`Search: q="${q}" type="${type}" limit=${searchLimit} offset=${searchOffset}`);

  //     const results = searchEngine.search(q, {
  //       limit: searchLimit,
  //       offset: searchOffset,
  //       type: type as any || 'all',
  //       useFuzzy,
  //       usePhrase
  //     });

  //     res.json(results);
  //   } catch (error) {
  //     logger.error('Search failed', error);
  //     res.status(500).json({ error: 'Search failed', details: String(error) });
  //   }
  // });

  // router.get('/search/:type', (req: Request, res: Response) => {
  //   try {
  //     const { type } = req.params;
  //     const { q, limit = '20', offset = '0', fuzzy = 'false', phrase = 'false' } = req.query;
      
  //     if (!q || typeof q !== 'string') {
  //       return res.status(400).json({ error: 'Query parameter "q" is required' });
  //     }

  //     if (!['tweet', 'user', 'hashtag', 'url'].includes(type)) {
  //       return res.status(400).json({ error: 'Invalid type. Must be: tweet, user, hashtag, or url' });
  //     }

  //     const searchLimit = Math.min(parseInt(limit as string, 10) || 20, 100);
  //     const searchOffset = Math.max(parseInt(offset as string, 10) || 0, 0);
  //     const useFuzzy = fuzzy === 'true';
  //     const usePhrase = phrase === 'true';

  //     logger.info(`Search by type: q="${q}" type="${type}" limit=${searchLimit}`);

  //     const results = searchEngine.searchByType(q, type as any, searchLimit, searchOffset);

  //     res.json(results);
  //   } catch (error) {
  //     logger.error('Search by type failed', error);
  //     res.status(500).json({ error: 'Search by type failed', details: String(error) });
  //   }
  // });

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
    score += (user.followersCount || 0) * 0.01;
    
    return score;
  };

export function twitterSearchRoutes(crawler: Crawler,
  parser: Parser,
  indexer: Indexer,
  searchEngine: SearchEngine,
  persistence: PersistenceManager) {
  const router = Router();
  const logger = new Logger('TwitterSearch');

  // ===========================
  // HELPER FUNCTIONS
  // ===========================

 
  // ===========================
  // 1. TOP - Mixed results (Tweets + Users like X)
  // ===========================
  router.get('/search/top', async (req: Request, res: Response) => {
    try {
      const {
        q = '',
     
        
      } = req.query;
const userId=(req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      logger.info(`Top search: q="${q}"`);

      // Search tweets using search engine
      const tweetResults =searchEngine.searchByType(q, "tweet", 50, 0,indexer.getDocuments());
      console.log("doc",indexer.getDocuments());
      // Search users using search engine
      const userResults = searchEngine.searchByType(q, "user", 10, 0,indexer.getDocuments());
console.log("tweetResults",tweetResults,"userResults",userResults);
      
          
     

     

    
     
      const scoredTweets = tweetResults.results
        .map((tweet: any) => ({
          ...tweet,
          score: calculateEngagementScore(tweet),
          type: 'tweet' as const,
        }))
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 20);

      // Score and sort users
      const scoredUsers = userResults.results
        .map((user: any) => ({
          ...user,
          score: calculateUserRelevanceScore(user, q),
          type: 'user' as const,
        }))
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 3); // Top 3 users like X

      // Remove internal fields
      const cleanedUsers = scoredUsers.map(({ score, ...user }: any) => user);
      const cleanedTweets = scoredTweets.map(({ score, ...tweet }: any) => tweet);

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
        offset = '0',
        
      } = req.query;
const userId=(req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      const searchLimit = Math.min(parseInt(limit as string, 10) || 20, 100);
      const searchOffset = Math.max(parseInt(offset as string, 10) || 0, 0);

      logger.info(`Latest search: q="${q}" limit=${searchLimit}`);

      // Search tweets using search engine
      const results = searchEngine.searchByType(q, 'tweet', searchLimit, searchOffset);

      res.json({
        query: q,
        type: 'latest',
        results: results.results,
        total: results.total,
        limit: searchLimit,
        offset: searchOffset,
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
        offset = '0',
        
      } = req.query;
const userId=(req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      const searchLimit = Math.min(parseInt(limit as string, 10) || 20, 100);
      const searchOffset = Math.max(parseInt(offset as string, 10) || 0, 0);

      logger.info(`People search: q="${q}" limit=${searchLimit}`);

      // Search users using search engine
      const userResults = searchEngine.searchByType(q, 'user', searchLimit * 2, searchOffset);

      // Score users by relevance
      const scoredUsers = userResults.results.map((user: any) => ({
        ...user,
        score: calculateUserRelevanceScore(user, q),
      }));

      scoredUsers.sort((a: any, b: any) => b.score - a.score);

      const results = scoredUsers.slice(0, searchLimit);

      res.json({
        query: q,
        type: 'people',
        results: results.map(({ score, ...user }: any) => user),
        total: results.length,
        limit: searchLimit,
        offset: searchOffset,
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
        offset = '0',
        
      } = req.query;
const userId=(req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      const searchLimit = Math.min(parseInt(limit as string, 10) || 20, 100);
      const searchOffset = Math.max(parseInt(offset as string, 10) || 0, 0);

      logger.info(`Media search: q="${q}" limit=${searchLimit}`);

      // Search tweets using search engine
      const tweetResults = searchEngine.searchByType(q, 'tweet', searchLimit * 3, searchOffset);

      // Filter tweets that have media
      const tweetsWithMedia = tweetResults.results.filter((tweet: any) => 
        tweet.tweetMedia && tweet.tweetMedia.length > 0
      );

      const results = tweetsWithMedia.slice(0, searchLimit);

      res.json({
        query: q,
        type: 'media',
        results: results,
        total: results.length,
        limit: searchLimit,
        offset: searchOffset,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Media search failed', error);
      res.status(500).json({ error: 'Search failed', details: String(error) });
    }
  });

  // ===========================
  // 5. GENERIC SEARCH BY TYPE
  // ===========================
  return router;

}

export function chatSearchRoutes(
  parser: Parser,
  indexer: Indexer,
  searchEngine: SearchEngine,
  persistence: PersistenceManager
) {
  const router = Router();
  const chatSearchEngine = new ChatSearchEngine(
    prisma,
    parser,
    indexer,
    searchEngine,
    persistence
  );
  const logger = new Logger('ChatSearchRoutes');

  // ===========================
  // SEARCH MESSAGES
  // ===========================
  router.get('/chat/search/messages', async (req: Request, res: Response) => {
    try {
      const {
        q = '',
        limit = '20',
        offset = '0',
       
      } = req.query;
const userId=(req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      if (!q || (q as string).trim().length === 0) {
        return res.status(400).json({ error: 'Search query required' });
      }

      const searchLimit = Math.min(parseInt(limit as string, 10) || 20, 50);
      const searchOffset = parseInt(offset as string, 10) || 0;

      const results = await chatSearchEngine.searchMessages(
        q as string,
        userId as string,
        searchLimit,
        searchOffset
      );

      res.json(results);
    } catch (error) {
      logger.error('Message search failed', error);
      res.status(500).json({ 
        error: 'Search failed', 
        details: String(error) 
      });
    }
  });

  // ===========================
  // SEARCH CONVERSATIONS
  // ===========================
  router.get('/chat/search/conversations', async (req: Request, res: Response) => {
    try {
      const {
        q = '',
        limit = '20',
        offset = '0',
       
      } = req.query;
const userId=(req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      if (!q || (q as string).trim().length === 0) {
        return res.status(400).json({ error: 'Search query required' });
      }

      const searchLimit = Math.min(parseInt(limit as string, 10) || 20, 50);
      const searchOffset = parseInt(offset as string, 10) || 0;

      const results = await chatSearchEngine.searchConversations(
        q as string,
        userId as string,
        searchLimit,
        searchOffset
      );

      res.json(results);
    } catch (error) {
      logger.error('Conversation search failed', error);
      res.status(500).json({ 
        error: 'Search failed', 
        details: String(error) 
      });
    }
  });

  // ===========================
  // SEARCH ALL (MESSAGES + CONVERSATIONS)
  // ===========================
  router.get('/chat/search/all', async (req: Request, res: Response) => {
    try {
      const {
        q = '',
        limit = '20',
        offset = '0',
      
      } = req.query;
const userId=(req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      if (!q || (q as string).trim().length === 0) {
        return res.status(400).json({ error: 'Search query required' });
      }

      const searchLimit = Math.min(parseInt(limit as string, 10) || 20, 50);
      const searchOffset = parseInt(offset as string, 10) || 0;

      const results = await chatSearchEngine.searchAll(
        q as string,
        userId as string,
        searchLimit,
        searchOffset
      );

      res.json(results);
    } catch (error) {
      logger.error('Combined search failed', error);
      res.status(500).json({ 
        error: 'Search failed', 
        details: String(error) 
      });
    }
  });

  // ===========================
  // REINDEX USER CHATS
  // ===========================
  router.post('/chat/search/reindex', async (req: Request, res: Response) => {
    try {
      const userId=(req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      logger.info(`Reindexing chats for user ${userId}`);

      await chatSearchEngine.indexUserChats(userId, true);

      res.json({
        success: true,
        message: 'Chats reindexed successfully',
        userId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Reindex failed', error);
      res.status(500).json({ 
        error: 'Reindex failed', 
        details: String(error) 
      });
    }
  });

  // ===========================
  // GET INDEX STATS
  // ===========================
  router.get('/chat/search/stats', async (req: Request, res: Response) => {
    try {
      const userId=(req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }

      const stats = indexer.getIndexStats();

      res.json({
        ...stats,
        userId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get stats', error);
      res.status(500).json({ 
        error: 'Failed to get stats', 
        details: String(error) 
      });
    }
  });

  return router;
}

export default {twitterSearchRoutes,chatSearchRoutes};