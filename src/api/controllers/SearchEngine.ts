// ===========================
// TYPES & INTERFACES
// ===========================

interface CrawledData {
  url: string;
  content: string;
  title: string;
  timestamp: number;
}

interface ParsedDocument {
  id: string;
  url: string;
  title: string;
  content: string;
  tokens: string[];
  timestamp: number;
}

interface IndexedDocument {
  id: string;
  url: string;
  title: string;
  content: string;
  timestamp: number;
}

interface InvertedIndex {
  [term: string]: Set<string>; // term -> document IDs
}

interface SearchResult {
  id: string;
  url: string;
  title: string;
  snippet: string;
  score: number;
}

// ===========================
// CRAWLER
// ===========================

class Crawler {
  private crawledUrls: Set<string> = new Set();
  private crawlData: CrawledData[] = [];

  async crawl(url: string): Promise<CrawledData | null> {
    if (this.crawledUrls.has(url)) {
      console.log(`Already crawled: ${url}`);
      return null;
    }

    try {
      console.log(`Crawling: ${url}`);
      
      // Simulate HTTP request (in production, use axios or fetch)
      const response = await this.fetchUrl(url);
      
      const crawledData: CrawledData = {
        url,
        content: response.content,
        title: response.title,
        timestamp: Date.now()
      };

      this.crawledUrls.add(url);
      this.crawlData.push(crawledData);
      
      return crawledData;
    } catch (error) {
      console.error(`Failed to crawl ${url}:`, error);
      return null;
    }
  }

  async crawlMultiple(urls: string[]): Promise<CrawledData[]> {
    const results: CrawledData[] = [];
    
    for (const url of urls) {
      const data = await this.crawl(url);
      if (data) results.push(data);
    }
    
    return results;
  }

  private async fetchUrl(url: string): Promise<{ content: string; title: string }> {
    // Simulate fetching (replace with real HTTP client in production)
    // For demo purposes, returning mock data
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          title: `Page Title for ${url}`,
          content: `This is sample content from ${url}. It contains various information about topics like technology, programming, and web development.`
        });
      }, 100);
    });
  }

  getCrawledData(): CrawledData[] {
    return this.crawlData;
  }
}

// ===========================
// PARSER
// ===========================

class Parser {
  private stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'this', 'but', 'they', 'have', 'had'
  ]);

  parse(crawledData: CrawledData): ParsedDocument {
    const id = this.generateId(crawledData.url);
    const tokens = this.tokenize(crawledData.content);
    
    return {
      id,
      url: crawledData.url,
      title: crawledData.title,
      content: crawledData.content,
      tokens,
      timestamp: crawledData.timestamp
    };
  }

  parseMultiple(crawledDataArray: CrawledData[]): ParsedDocument[] {
    return crawledDataArray.map(data => this.parse(data));
  }

  private tokenize(text: string): string[] {
    // Convert to lowercase and split into words
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    // Remove stop words
    const filtered = words.filter(word => !this.stopWords.has(word));
    
    return filtered;
  }

  private generateId(url: string): string {
    // Simple hash function for ID generation
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

// ===========================
// INDEXER
// ===========================

class Indexer {
  private invertedIndex: InvertedIndex = {};
  private documents: Map<string, IndexedDocument> = new Map();

  index(parsedDoc: ParsedDocument): void {
    // Store document
    this.documents.set(parsedDoc.id, {
      id: parsedDoc.id,
      url: parsedDoc.url,
      title: parsedDoc.title,
      content: parsedDoc.content,
      timestamp: parsedDoc.timestamp
    });

    // Build inverted index
    parsedDoc.tokens.forEach(token => {
      if (!this.invertedIndex[token]) {
        this.invertedIndex[token] = new Set();
      }
      this.invertedIndex[token].add(parsedDoc.id);
    });

    console.log(`Indexed document: ${parsedDoc.title} (${parsedDoc.id})`);
  }

  indexMultiple(parsedDocs: ParsedDocument[]): void {
    parsedDocs.forEach(doc => this.index(doc));
  }

  getInvertedIndex(): InvertedIndex {
    return this.invertedIndex;
  }

  getDocuments(): Map<string, IndexedDocument> {
    return this.documents;
  }

  getIndexStats() {
    return {
      totalDocuments: this.documents.size,
      totalTerms: Object.keys(this.invertedIndex).length,
      averageTermsPerDoc: this.documents.size > 0 
        ? Object.keys(this.invertedIndex).length / this.documents.size 
        : 0
    };
  }
}

// ===========================
// SEARCH ENGINE
// ===========================

class SearchEngine {
  private indexer: Indexer;
  private parser: Parser;

  constructor(indexer: Indexer) {
    this.indexer = indexer;
    this.parser = new Parser();
  }

  search(query: string, limit: number = 10): SearchResult[] {
    // Tokenize query
    const queryTokens = this.parser['tokenize'](query);
    
    if (queryTokens.length === 0) {
      return [];
    }

    // Find matching documents
    const docScores = new Map<string, number>();
    const invertedIndex = this.indexer.getInvertedIndex();

    queryTokens.forEach(token => {
      const docIds = invertedIndex[token];
      if (docIds) {
        docIds.forEach(docId => {
          const currentScore = docScores.get(docId) || 0;
          docScores.set(docId, currentScore + 1);
        });
      }
    });

    // Sort by score and convert to results
    const documents = this.indexer.getDocuments();
    const results: SearchResult[] = [];

    docScores.forEach((score, docId) => {
      const doc = documents.get(docId);
      if (doc) {
        results.push({
          id: doc.id,
          url: doc.url,
          title: doc.title,
          snippet: this.generateSnippet(doc.content, queryTokens),
          score
        });
      }
    });

    // Sort by score (descending) and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private generateSnippet(content: string, queryTokens: string[]): string {
    const words = content.split(' ');
    const snippetLength = 150;

    // Find first occurrence of any query token
    let startIndex = 0;
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase();
      if (queryTokens.some(token => word.includes(token))) {
        startIndex = Math.max(0, i - 10);
        break;
      }
    }

    const snippet = words.slice(startIndex, startIndex + 30).join(' ');
    return snippet.length > snippetLength 
      ? snippet.substring(0, snippetLength) + '...'
      : snippet;
  }
}

// ===========================
// EXPRESS API
// ===========================

import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

// Initialize components
const crawler = new Crawler();
const parser = new Parser();
const indexer = new Indexer();
const searchEngine = new SearchEngine(indexer);

// ===========================
// API ENDPOINTS
// ===========================

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Crawl and index a URL
app.post('/crawl', async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const crawledData = await crawler.crawl(url);
    
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

// Crawl and index multiple URLs
app.post('/crawl/batch', async (req: Request, res: Response) => {
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

// Search endpoint
app.get('/search', (req: Request, res: Response) => {
  const { q, limit } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  const searchLimit = limit ? parseInt(limit as string) : 10;
  const results = searchEngine.search(q, searchLimit);

  res.json({
    query: q,
    results,
    total: results.length,
    timestamp: new Date().toISOString()
  });
});

// Get index statistics
app.get('/stats', (req: Request, res: Response) => {
  const stats = indexer.getIndexStats();
  res.json(stats);
});

// Get all indexed documents
app.get('/documents', (req: Request, res: Response) => {
  const documents = Array.from(indexer.getDocuments().values());
  res.json({
    total: documents.length,
    documents
  });
});

