export const redisClient = {
  connect: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn().mockResolvedValue(true),
  ping: jest.fn().mockResolvedValue("PONG"),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue("OK"),
  del: jest.fn().mockResolvedValue(1),
  flushAll: jest.fn().mockResolvedValue("OK"),
};
export default redisClient;
