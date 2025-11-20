import { Router, Request, Response } from 'express';
import { Crawler, Parser, Indexer, SearchEngine } from '../controllers/SearchEngine';

export default function apiRoutes(
  crawler: Crawler,
  parser: Parser,
  indexer: Indexer,
  searchEngine: SearchEngine
) {
  const router = Router();

  // Health check
  router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Crawl single URL
  router.post('/crawl', async (req: Request, res: Response) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    try {
      const crawledData = await crawler.crawlUrl(url);
      if (!crawledData) {
        return res.status(400).json({ error: 'URL already crawled or failed' });
      }

      const parsedDoc = parser.parse(crawledData);
      indexer.index(parsedDoc);

      res.json({
        message: 'URL crawled and indexed successfully',
        documentId: parsedDoc.id,
        url: parsedDoc.url,
        title: parsedDoc.title
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to crawl and index URL' });
    }
  });

  // Crawl multiple URLs
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
          title: doc.title
        }))
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to crawl and index URLs' });
    }
  });

  // Search
  router.get('/search', (req: Request, res: Response) => {
    const { q, limit } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const searchLimit = limit ? (parseInt(limit as string, 10) || 10) : 10;
    const results = searchEngine.search(q, { limit: searchLimit });

    res.json({
      query: q,
      results,
      total: results.length,
      timestamp: new Date().toISOString()
    });
  });

  // Stats
  router.get('/stats', (req: Request, res: Response) => {
    const stats = indexer.getIndexStats();
    res.json(stats);
  });

  // Documents
  router.get('/documents', (req: Request, res: Response) => {
    const documents = Array.from(indexer.getDocuments().values());
    res.json({
      total: documents.length,
      documents
    });
  });

  return router;
}