// src/search/searchEngine.ts
import { Indexer } from "./indexer";
import { Parser, ParsedTweet, ParsedUser } from "./parser";
import { PersistenceManager } from "./persistence";

export interface SearchCursor {
  id?: string;
  createdAt?: string;
  score?: number;
}

export interface SearchResult<T> {
  data: T[];
  cursor: string | null; // Encoded cursor for next page
  total: number;
}
export interface SearchResult2<T> {
  data: T;
  cursor: string | null; // Encoded cursor for next page
  total: number;
}
export interface TopSearchResult {
  tweets: ParsedTweet[];
  users: ParsedUser[];
}

export class SearchEngine {
  constructor(
    private indexer: Indexer,
    private parser: Parser,
    private persistence: PersistenceManager
  ) {}

  /**
   * Search for top results (tweets + users)
   * No pagination for top results - always returns top 3 of each
   */
 /**
 * Search for top results (tweets + users) with cursor pagination
 */
searchTop(
  query: string,
  limit: number = 6,
  cursor?: SearchCursor
): SearchResult2<TopSearchResult> {


  const parsedQuery = this.parser.parseQuery(query);

  // --- TWEETS SEARCH ---
  let tweetIds = new Set<string>();

  if (parsedQuery.tokens.length > 0) {
    tweetIds = this.indexer.searchTweets(parsedQuery.tokens);
  }

  parsedQuery.hashtags.forEach((hashtag) => {
    this.indexer.searchByHashtag(hashtag).forEach(id => tweetIds.add(id));
  });

  parsedQuery.mentions.forEach((mention) => {
    this.indexer.searchByMention(mention).forEach(id => tweetIds.add(id));
  });

  // Sort by score DESC
  let tweets = this.indexer
    .getTweets(Array.from(tweetIds))
    .sort((a, b) => b.score - a.score);

  // Apply cursor to tweets
  if (cursor?.id && cursor?.score !== undefined) {
    const cursorIndex = tweets.findIndex(
      t => t.id === cursor.id && t.score === cursor.score
    );
    if (cursorIndex !== -1) {
      tweets = tweets.slice(cursorIndex + 1);
    }
  }

  const hasNextPageTweets = tweets.length > limit;
  const paginatedTweets = hasNextPageTweets ? tweets.slice(0, limit) : tweets;

  const lastTweet = paginatedTweets[paginatedTweets.length - 1];
  const nextTweetCursor = hasNextPageTweets && lastTweet
    ? this.encodeCursor({ id: lastTweet.id, score: lastTweet.score })
    : null;



  // --- USERS SEARCH ---
  let userIds = new Set<string>();
  if (query.trim().length > 0) {
    const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    userIds = this.indexer.searchUsers(queryTokens);
  }

  let users = this.indexer
    .getUsers(Array.from(userIds))
    .sort((a, b) => b.score - a.score);

  // Apply cursor to users also
  if (cursor?.id && cursor?.score !== undefined) {
    const cursorIndex = users.findIndex(
      u => u.id === cursor.id && u.score === cursor.score
    );
    if (cursorIndex !== -1) {
      users = users.slice(cursorIndex + 1);
    }
  }

  const hasNextPageUsers = users.length > limit;
  const paginatedUsers = hasNextPageUsers ? users.slice(0, limit) : users;

  const lastUser = paginatedUsers[paginatedUsers.length - 1];
  const nextUserCursor = hasNextPageUsers && lastUser
    ? this.encodeCursor({ id: lastUser.id, score: lastUser.score })
    : null;


  // Final cursor → whichever exists (tweet or user)
  const nextCursor = nextTweetCursor || nextUserCursor;

  return {
    data: {
      tweets: paginatedTweets,
      users: paginatedUsers,
    },
    cursor: nextCursor,
    total: tweetIds.size + userIds.size,
  };
}


  /**
   * Search for people with cursor pagination
   */
  searchPeople(
    query: string,
    limit: number = 20,
    cursor?: SearchCursor
  ): SearchResult<ParsedUser> {
    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    const userIds = this.indexer.searchUsers(queryTokens);

    // Get all matching users and sort by score
    let users = this.indexer
      .getUsers(Array.from(userIds))
      .sort((a, b) => b.score - a.score);

    // Apply cursor filtering if provided
    if (cursor?.id && cursor?.score !== undefined) {
      const cursorIndex = users.findIndex(
        u => u.id === cursor.id && u.score === cursor.score
      );
      if (cursorIndex !== -1) {
        users = users.slice(cursorIndex + 1);
      }
    }

    // Take limit + 1 to check if there's a next page
    const hasNextPage = users.length > limit;
    const paginatedUsers = hasNextPage ? users.slice(0, limit) : users;

    // Generate next cursor
    const lastUser = paginatedUsers[paginatedUsers.length - 1];
    const nextCursor = hasNextPage && lastUser
      ? this.encodeCursor({ id: lastUser.id, score: lastUser.score })
      : null;

    return {
      data: paginatedUsers,
      cursor: nextCursor,
      total: userIds.size,
    };
  }

  /**
   * Search for latest tweets with cursor pagination
   */
  searchLatest(
    query: string,
    limit: number = 20,
    cursor?: SearchCursor
  ): SearchResult<ParsedTweet> {
    const parsedQuery = this.parser.parseQuery(query);

    let tweetIds = new Set<string>();

    if (parsedQuery.tokens.length > 0) {
      tweetIds = this.indexer.searchTweets(parsedQuery.tokens);
    }

    // Add hashtag results
    parsedQuery.hashtags.forEach((hashtag) => {
      const hashtagResults = this.indexer.searchByHashtag(hashtag);
      hashtagResults.forEach((id) => tweetIds.add(id));
    });

    // Add mention results
    parsedQuery.mentions.forEach((mention) => {
      const mentionResults = this.indexer.searchByMention(mention);
      mentionResults.forEach((id) => tweetIds.add(id));
    });

    // Sort by creation date (latest first)
    let tweets = this.indexer
      .getTweets(Array.from(tweetIds))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply cursor filtering if provided
    if (cursor?.id && cursor?.createdAt) {
      const cursorDate = new Date(cursor.createdAt).getTime();
      const cursorIndex = tweets.findIndex(
        t => t.id === cursor.id && t.createdAt.getTime() === cursorDate
      );
      if (cursorIndex !== -1) {
        tweets = tweets.slice(cursorIndex + 1);
      }
    }

    // Take limit + 1 to check if there's a next page
    const hasNextPage = tweets.length > limit;
    const paginatedTweets = hasNextPage ? tweets.slice(0, limit) : tweets;

    // Generate next cursor
    const lastTweet = paginatedTweets[paginatedTweets.length - 1];
    const nextCursor = hasNextPage && lastTweet
      ? this.encodeCursor({ 
          id: lastTweet.id, 
          createdAt: lastTweet.createdAt.toISOString() 
        })
      : null;

    return {
      data: paginatedTweets,
      cursor: nextCursor,
      total: tweetIds.size,
    };
  }

  /**
   * Search for tweets with media and cursor pagination
   */
  searchMedia(
    query: string,
    limit: number = 20,
    cursor?: SearchCursor
  ): SearchResult<ParsedTweet> {
    const parsedQuery = this.parser.parseQuery(query);
    let tweetIds = new Set<string>();

    // Start with media tweets only
    const mediaTweetIds = this.indexer.getMediaTweets();

    if (parsedQuery.tokens.length > 0) {
      const searchResults = this.indexer.searchTweets(parsedQuery.tokens);
      // Intersection: tweets that match query AND have media
      searchResults.forEach((id) => {
        if (mediaTweetIds.has(id)) {
          tweetIds.add(id);
        }
      });
    } else {
      // If no query, return all media tweets
      tweetIds = mediaTweetIds;
    }

    // Add hashtag results (that also have media)
    parsedQuery.hashtags.forEach((hashtag) => {
      const hashtagResults = this.indexer.searchByHashtag(hashtag);
      hashtagResults.forEach((id) => {
        if (mediaTweetIds.has(id)) {
          tweetIds.add(id);
        }
      });
    });

    // Sort by score (engagement)
    let tweets = this.indexer
      .getTweets(Array.from(tweetIds))
      .sort((a, b) => b.score - a.score);

    // Apply cursor filtering if provided
    if (cursor?.id && cursor?.score !== undefined) {
      const cursorIndex = tweets.findIndex(
        (t) => t.id === cursor.id && t.score === cursor.score
      );
      if (cursorIndex !== -1) {
        tweets = tweets.slice(cursorIndex + 1);
      }
    }

    // Take limit + 1 to check if there's a next page
    const hasNextPage = tweets.length > limit;
    const paginatedTweets = hasNextPage ? tweets.slice(0, limit) : tweets;

    // Generate next cursor
    const lastTweet = paginatedTweets[paginatedTweets.length - 1];
    const nextCursor =
      hasNextPage && lastTweet
        ? this.encodeCursor({ id: lastTweet.id, score: lastTweet.score })
        : null;

    return {
      data: paginatedTweets,
      cursor: nextCursor,
      total: tweetIds.size,
    };
  }


  /**
   * Get index statistics
   */
  getStats() {
    return this.indexer.getStats();
  }

  /**
   * Save index to persistence
   */
  async saveIndex(key: string = "search_index"): Promise<void> {
    const indexDoc = this.indexer.exportIndex();
    await this.persistence.saveIndex(key, indexDoc);

    const metadata = {
      lastUpdated: new Date().toISOString(),
      stats: this.getStats(),
    };
    await this.persistence.saveIndexMetadata(key, metadata);
  }

  /**
   * Load index from persistence
   */
  async loadIndex(key: string = "search_index"): Promise<boolean> {
    const indexDoc = await this.persistence.loadIndex(key);
    if (!indexDoc) return false;

    this.indexer.importIndex(indexDoc);
    return true;
  }

  /**
   * Encode cursor to base64 string (similar to your encoderService)
   */
  private encodeCursor(cursor: SearchCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64');
  }

  /**
   * Decode cursor from base64 string (similar to your encoderService)
   */
  decodeCursor(encodedCursor: string): SearchCursor | null {
    try {
      const decoded = Buffer.from(encodedCursor, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }
}