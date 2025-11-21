import {Logger,Crawler, Parser, Indexer, SearchEngine, PersistenceManager, ParsedDocument, CrawledTweet, CrawledUser, CrawledHashtag} from '../controllers/SearchEngine';
import { Router, Request, Response } from 'express';
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