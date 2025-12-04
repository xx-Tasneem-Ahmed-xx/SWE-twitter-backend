export const redisClient = {
  connect: jest.fn().mockResolvedValue(true),
  on: jest.fn(),
  set: jest.fn().mockResolvedValue(true),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
};
