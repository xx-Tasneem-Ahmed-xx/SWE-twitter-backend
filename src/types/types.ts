export type SearchParams = {
  userId: string;
  where: any;
  limit: number;
  query: string;
  cursor?: { id: string };
};
