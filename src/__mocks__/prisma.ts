// src/__mocks__/prisma.ts

export const prisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  fcmToken: {
    create: jest.fn(),
  },
};
