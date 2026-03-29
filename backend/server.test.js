// ─────────────────────────────────────────────────────────────────────────────
// server.test.js — Chatify Backend Automated Tests (CI Pipeline)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────
// vi.hoisted ensures these are available before vi.mock factories execute.

const {
  mockCloudinaryUpload,
  mockSendWelcomeEmail,
  mockGetReceiverSocketId,
  mockIoTo,
  mockSocketToEmit,
} = vi.hoisted(() => {
  const mockSocketToEmit = vi.fn();
  return {
    mockCloudinaryUpload: vi.fn(),
    mockSendWelcomeEmail: vi.fn(),
    mockGetReceiverSocketId: vi.fn(),
    mockIoTo: vi.fn(() => ({ emit: mockSocketToEmit })),
    mockSocketToEmit,
  };
});

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock("./src/lib/env.js", () => ({
  ENV: {
    PORT: "5001",
    JWT_SECRET: "test-jwt-secret-key-for-ci-pipeline",
    NODE_ENV: "development",
    CLIENT_URL: "http://localhost:5173",
    MONGO_URI: "",
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "noreply@chatify-test.com",
    EMAIL_FROM_NAME: "Chatify Test",
    CLOUDINARY_CLOUD_NAME: "test-cloud",
    CLOUDINARY_API_KEY: "test-api-key",
    CLOUDINARY_API_SECRET: "test-api-secret",
    ARCJET_KEY: "ajkey_test",
    ARCJET_ENV: "development",
  },
}));

vi.mock("./src/lib/cloudinary.js", () => ({
  default: {
    uploader: { upload: mockCloudinaryUpload },
  },
}));

vi.mock("./src/emails/emailHandlers.js", () => ({
  sendWelcomeEmail: mockSendWelcomeEmail,
}));

vi.mock("./src/lib/socket.js", () => ({
  app: null,
  server: null,
  io: { to: mockIoTo, emit: vi.fn() },
  getReceiverSocketId: mockGetReceiverSocketId,
}));

vi.mock("./src/middleware/arcjet.middleware.js", () => ({
  arcjetProtection: (_req, _res, next) => next(),
}));

vi.mock("./src/lib/arcjet.js", () => ({
  default: {},
}));

vi.mock("./src/lib/resend.js", () => ({
  resendClient: { emails: { send: vi.fn() } },
  sender: { email: "noreply@chatify-test.com", name: "Chatify Test" },
}));

vi.mock("./src/middleware/socket.auth.middleware.js", () => ({
  socketAuthMiddleware: vi.fn((_socket, next) => next()),
}));

// ─── Source Imports (loaded AFTER mocks are registered) ───────────────────────

import User from "./src/models/User.js";
import Message from "./src/models/Message.js";
import { signup, login, logout, updateProfile } from "./src/controllers/auth.controller.js";
import {
  getAllContacts,
  getMessagesByUserId,
  sendMessage,
  getChatPartners,
} from "./src/controllers/message.controller.js";
import { protectRoute } from "./src/middleware/auth.middleware.js";
import { generateToken } from "./src/lib/utils.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const JWT_SECRET = "test-jwt-secret-key-for-ci-pipeline";

// ─── Test Express App ─────────────────────────────────────────────────────────
// Build a standalone Express app that mirrors production routing but without
// Socket.IO, Arcjet, or real external service calls.

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

// Auth routes
app.post("/api/auth/signup", signup);
app.post("/api/auth/login", login);
app.post("/api/auth/logout", logout);
app.put("/api/auth/update-profile", protectRoute, updateProfile);
app.get("/api/auth/check", protectRoute, (req, res) => res.status(200).json(req.user));

// Message routes
app.get("/api/messages/contacts", protectRoute, getAllContacts);
app.get("/api/messages/chats", protectRoute, getChatPartners);
app.get("/api/messages/:id", protectRoute, getMessagesByUserId);
app.post("/api/messages/send/:id", protectRoute, sendMessage);

// ─── Helpers ──────────────────────────────────────────────────────────────────

let counter = 0;

async function createTestUser(overrides = {}) {
  counter++;
  const raw = overrides.rawPassword || "password123";
  const salt = await bcrypt.genSalt(4); // lower rounds → faster tests
  const hashedPassword = await bcrypt.hash(raw, salt);
  return User.create({
    fullName: overrides.fullName || `Test User ${counter}`,
    email: overrides.email || `testuser${counter}@example.com`,
    password: hashedPassword,
    profilePic: overrides.profilePic || "",
  });
}

function generateAuthToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

function authCookie(userId) {
  return `jwt=${generateAuthToken(userId)}`;
}

// ─── Database Lifecycle ───────────────────────────────────────────────────────

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Message.deleteMany({});
  vi.clearAllMocks();
  counter = 0;

  // Default mock implementations
  mockCloudinaryUpload.mockResolvedValue({
    secure_url: "https://res.cloudinary.com/test/image/upload/v1/test.jpg",
  });
  mockSendWelcomeEmail.mockResolvedValue(undefined);
  mockGetReceiverSocketId.mockReturnValue(null);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

describe("Auth API", () => {
  // ── Signup ────────────────────────────────────────────────────────────────

  describe("POST /api/auth/signup", () => {
    const signupPayload = {
      fullName: "Alice Johnson",
      email: "alice@example.com",
      password: "securepass123",
    };

    it("creates a new user and returns user data", async () => {
      const res = await request(app).post("/api/auth/signup").send(signupPayload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("_id");
      expect(res.body.fullName).toBe("Alice Johnson");
      expect(res.body.email).toBe("alice@example.com");
      expect(res.body).toHaveProperty("profilePic");
    });

    it("does not include password in the response", async () => {
      const res = await request(app).post("/api/auth/signup").send(signupPayload);

      expect(res.status).toBe(201);
      expect(res.body).not.toHaveProperty("password");
    });

    it("sets a jwt cookie on successful signup", async () => {
      const res = await request(app).post("/api/auth/signup").send(signupPayload);

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const jwtCookie = cookies.find((c) => c.startsWith("jwt="));
      expect(jwtCookie).toBeDefined();
      expect(jwtCookie).toContain("HttpOnly");
    });

    it("triggers welcome email after signup", async () => {
      await request(app).post("/api/auth/signup").send(signupPayload);

      expect(mockSendWelcomeEmail).toHaveBeenCalledWith(
        "alice@example.com",
        "Alice Johnson",
        "http://localhost:5173"
      );
    });

    it("returns 400 when required fields are missing", async () => {
      const res = await request(app).post("/api/auth/signup").send({ email: "a@b.com" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("All fields are required");
    });

    it("returns 400 when password is shorter than 6 characters", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({ ...signupPayload, password: "abc" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Password must be at least 6 characters");
    });

    it("returns 400 for invalid email format", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({ ...signupPayload, email: "not-an-email" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid email format");
    });

    it("returns 400 if email already exists", async () => {
      await createTestUser({ email: "alice@example.com" });

      const res = await request(app).post("/api/auth/signup").send(signupPayload);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Email already exists");
    });

    it("persists user to database", async () => {
      await request(app).post("/api/auth/signup").send(signupPayload);

      const user = await User.findOne({ email: "alice@example.com" });
      expect(user).not.toBeNull();
      expect(user.fullName).toBe("Alice Johnson");
    });

    it("stores hashed password, not plain text", async () => {
      await request(app).post("/api/auth/signup").send(signupPayload);

      const user = await User.findOne({ email: "alice@example.com" });
      expect(user.password).not.toBe("securepass123");
      const isMatch = await bcrypt.compare("securepass123", user.password);
      expect(isMatch).toBe(true);
    });
  });

  // ── Login ─────────────────────────────────────────────────────────────────

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      await createTestUser({
        email: "bob@example.com",
        fullName: "Bob Smith",
        rawPassword: "mypassword",
      });
    });

    it("authenticates user and returns user data", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "bob@example.com", password: "mypassword" });

      expect(res.status).toBe(200);
      expect(res.body.fullName).toBe("Bob Smith");
      expect(res.body.email).toBe("bob@example.com");
      expect(res.body).toHaveProperty("_id");
      expect(res.body).not.toHaveProperty("password");
    });

    it("sets jwt cookie on successful login", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "bob@example.com", password: "mypassword" });

      const cookies = res.headers["set-cookie"];
      const jwtCookie = cookies.find((c) => c.startsWith("jwt="));
      expect(jwtCookie).toBeDefined();
    });

    it("returns 400 when email or password is missing", async () => {
      const res = await request(app).post("/api/auth/login").send({ email: "bob@example.com" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Email and password are required");
    });

    it("returns 400 for non-existent email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@example.com", password: "mypassword" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid credentials");
    });

    it("returns 400 for wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "bob@example.com", password: "wrongpassword" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid credentials");
    });

    it("uses the same error message for wrong email and wrong password", async () => {
      const wrongEmail = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@example.com", password: "mypassword" });

      const wrongPass = await request(app)
        .post("/api/auth/login")
        .send({ email: "bob@example.com", password: "wrongpassword" });

      // Security: identical error message prevents credential enumeration
      expect(wrongEmail.body.message).toBe(wrongPass.body.message);
    });
  });

  // ── Logout ────────────────────────────────────────────────────────────────

  describe("POST /api/auth/logout", () => {
    it("clears the jwt cookie and returns success message", async () => {
      const res = await request(app).post("/api/auth/logout");

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Logged out successfully");

      const cookies = res.headers["set-cookie"];
      const jwtCookie = cookies.find((c) => c.startsWith("jwt="));
      expect(jwtCookie).toContain("Max-Age=0");
    });
  });

  // ── Auth Check ────────────────────────────────────────────────────────────

  describe("GET /api/auth/check", () => {
    it("returns authenticated user data", async () => {
      const user = await createTestUser({ fullName: "Carol Diaz" });

      const res = await request(app)
        .get("/api/auth/check")
        .set("Cookie", authCookie(user._id));

      expect(res.status).toBe(200);
      expect(res.body.fullName).toBe("Carol Diaz");
      expect(res.body).not.toHaveProperty("password");
    });

    it("returns 401 when no token is provided", async () => {
      const res = await request(app).get("/api/auth/check");

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized - No token provided");
    });

    it("returns 500 when token is invalid", async () => {
      const res = await request(app)
        .get("/api/auth/check")
        .set("Cookie", "jwt=invalidtoken123");

      expect(res.status).toBe(500);
    });

    it("returns 404 when token references a deleted user", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get("/api/auth/check")
        .set("Cookie", authCookie(fakeId));

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("User not found");
    });
  });

  // ── Update Profile ────────────────────────────────────────────────────────

  describe("PUT /api/auth/update-profile", () => {
    it("updates the profile picture via cloudinary", async () => {
      const user = await createTestUser();

      const res = await request(app)
        .put("/api/auth/update-profile")
        .set("Cookie", authCookie(user._id))
        .send({ profilePic: "data:image/png;base64,iVBOR..." });

      expect(res.status).toBe(200);
      expect(res.body.profilePic).toBe(
        "https://res.cloudinary.com/test/image/upload/v1/test.jpg"
      );
      expect(mockCloudinaryUpload).toHaveBeenCalledWith("data:image/png;base64,iVBOR...");
    });

    it("persists the updated profile picture in the database", async () => {
      const user = await createTestUser();

      await request(app)
        .put("/api/auth/update-profile")
        .set("Cookie", authCookie(user._id))
        .send({ profilePic: "data:image/png;base64,abc" });

      const updated = await User.findById(user._id);
      expect(updated.profilePic).toBe(
        "https://res.cloudinary.com/test/image/upload/v1/test.jpg"
      );
    });

    it("returns 400 when profilePic is not provided", async () => {
      const user = await createTestUser();

      const res = await request(app)
        .put("/api/auth/update-profile")
        .set("Cookie", authCookie(user._id))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Profile pic is required");
    });

    it("returns 401 when not authenticated", async () => {
      const res = await request(app)
        .put("/api/auth/update-profile")
        .send({ profilePic: "data:image/png;base64,abc" });

      expect(res.status).toBe(401);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MESSAGE ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

describe("Message API", () => {
  let userA, userB, userC;

  beforeEach(async () => {
    userA = await createTestUser({ fullName: "User A", email: "a@example.com" });
    userB = await createTestUser({ fullName: "User B", email: "b@example.com" });
    userC = await createTestUser({ fullName: "User C", email: "c@example.com" });
  });

  // ── Get Contacts ──────────────────────────────────────────────────────────

  describe("GET /api/messages/contacts", () => {
    it("returns all users except the authenticated user", async () => {
      const res = await request(app)
        .get("/api/messages/contacts")
        .set("Cookie", authCookie(userA._id));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);

      const names = res.body.map((u) => u.fullName);
      expect(names).toContain("User B");
      expect(names).toContain("User C");
      expect(names).not.toContain("User A");
    });

    it("excludes password field from results", async () => {
      const res = await request(app)
        .get("/api/messages/contacts")
        .set("Cookie", authCookie(userA._id));

      res.body.forEach((user) => {
        expect(user).not.toHaveProperty("password");
      });
    });

    it("returns 401 without authentication", async () => {
      const res = await request(app).get("/api/messages/contacts");
      expect(res.status).toBe(401);
    });
  });

  // ── Get Chat Partners ─────────────────────────────────────────────────────

  describe("GET /api/messages/chats", () => {
    it("returns users that the authenticated user has chatted with", async () => {
      // A sent a message to B
      await Message.create({
        senderId: userA._id,
        receiverId: userB._id,
        text: "Hello B!",
      });
      // C sent a message to A
      await Message.create({
        senderId: userC._id,
        receiverId: userA._id,
        text: "Hey A!",
      });

      const res = await request(app)
        .get("/api/messages/chats")
        .set("Cookie", authCookie(userA._id));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);

      const ids = res.body.map((u) => u._id.toString());
      expect(ids).toContain(userB._id.toString());
      expect(ids).toContain(userC._id.toString());
    });

    it("returns empty array when user has no conversations", async () => {
      const res = await request(app)
        .get("/api/messages/chats")
        .set("Cookie", authCookie(userA._id));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("excludes password from chat partner data", async () => {
      await Message.create({
        senderId: userA._id,
        receiverId: userB._id,
        text: "Hi",
      });

      const res = await request(app)
        .get("/api/messages/chats")
        .set("Cookie", authCookie(userA._id));

      res.body.forEach((partner) => {
        expect(partner).not.toHaveProperty("password");
      });
    });
  });

  // ── Get Messages ──────────────────────────────────────────────────────────

  describe("GET /api/messages/:id", () => {
    it("returns messages between authenticated user and the specified user", async () => {
      await Message.create([
        { senderId: userA._id, receiverId: userB._id, text: "Hi B" },
        { senderId: userB._id, receiverId: userA._id, text: "Hi A" },
        { senderId: userA._id, receiverId: userC._id, text: "Hi C" }, // should NOT appear
      ]);

      const res = await request(app)
        .get(`/api/messages/${userB._id}`)
        .set("Cookie", authCookie(userA._id));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].text).toBe("Hi B");
      expect(res.body[1].text).toBe("Hi A");
    });

    it("returns empty array when no messages exist", async () => {
      const res = await request(app)
        .get(`/api/messages/${userB._id}`)
        .set("Cookie", authCookie(userA._id));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ── Send Message ──────────────────────────────────────────────────────────

  describe("POST /api/messages/send/:id", () => {
    it("sends a text message and persists it", async () => {
      const res = await request(app)
        .post(`/api/messages/send/${userB._id}`)
        .set("Cookie", authCookie(userA._id))
        .send({ text: "Hello!" });

      expect(res.status).toBe(201);
      expect(res.body.text).toBe("Hello!");
      expect(res.body.senderId.toString()).toBe(userA._id.toString());
      expect(res.body.receiverId.toString()).toBe(userB._id.toString());

      // Verify persisted in DB
      const msg = await Message.findById(res.body._id);
      expect(msg).not.toBeNull();
      expect(msg.text).toBe("Hello!");
    });

    it("sends a message with an image via cloudinary", async () => {
      const res = await request(app)
        .post(`/api/messages/send/${userB._id}`)
        .set("Cookie", authCookie(userA._id))
        .send({ text: "Check this out", image: "data:image/png;base64,abc" });

      expect(res.status).toBe(201);
      expect(res.body.image).toBe(
        "https://res.cloudinary.com/test/image/upload/v1/test.jpg"
      );
      expect(mockCloudinaryUpload).toHaveBeenCalledWith("data:image/png;base64,abc");
    });

    it("sends image-only message (no text)", async () => {
      const res = await request(app)
        .post(`/api/messages/send/${userB._id}`)
        .set("Cookie", authCookie(userA._id))
        .send({ image: "data:image/png;base64,xyz" });

      expect(res.status).toBe(201);
      expect(res.body.image).toBeDefined();
    });

    it("emits socket event when receiver is online", async () => {
      mockGetReceiverSocketId.mockReturnValue("socket-id-123");

      await request(app)
        .post(`/api/messages/send/${userB._id}`)
        .set("Cookie", authCookie(userA._id))
        .send({ text: "Real-time!" });

      expect(mockGetReceiverSocketId).toHaveBeenCalledWith(userB._id.toString());
      expect(mockIoTo).toHaveBeenCalledWith("socket-id-123");
      expect(mockSocketToEmit).toHaveBeenCalledWith(
        "newMessage",
        expect.objectContaining({ text: "Real-time!" })
      );
    });

    it("does not emit socket event when receiver is offline", async () => {
      mockGetReceiverSocketId.mockReturnValue(null);

      await request(app)
        .post(`/api/messages/send/${userB._id}`)
        .set("Cookie", authCookie(userA._id))
        .send({ text: "Offline message" });

      expect(mockIoTo).not.toHaveBeenCalled();
    });

    it("returns 400 when both text and image are missing", async () => {
      const res = await request(app)
        .post(`/api/messages/send/${userB._id}`)
        .set("Cookie", authCookie(userA._id))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Text or image is required.");
    });

    it("returns 400 when sending message to yourself", async () => {
      const res = await request(app)
        .post(`/api/messages/send/${userA._id}`)
        .set("Cookie", authCookie(userA._id))
        .send({ text: "Talking to myself" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Cannot send messages to yourself.");
    });

    it("returns 404 when receiver does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post(`/api/messages/send/${fakeId}`)
        .set("Cookie", authCookie(userA._id))
        .send({ text: "Hello ghost" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Receiver not found.");
    });

    it("returns 401 without authentication", async () => {
      const res = await request(app)
        .post(`/api/messages/send/${userB._id}`)
        .send({ text: "No auth" });

      expect(res.status).toBe(401);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTH MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

describe("protectRoute Middleware", () => {
  it("attaches user to req and calls next() with valid token", async () => {
    const user = await createTestUser({ fullName: "Middleware User" });

    // Use /api/auth/check which relies on protectRoute → req.user
    const res = await request(app)
      .get("/api/auth/check")
      .set("Cookie", authCookie(user._id));

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe("Middleware User");
  });

  it("returns 401 when no jwt cookie is present", async () => {
    const res = await request(app).get("/api/auth/check");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized - No token provided");
  });

  it("returns 500 when jwt cookie contains a malformed token", async () => {
    const res = await request(app)
      .get("/api/auth/check")
      .set("Cookie", "jwt=this.is.not.valid");

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal server error");
  });

  it("returns 404 when token is valid but user no longer exists", async () => {
    const deletedId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .get("/api/auth/check")
      .set("Cookie", authCookie(deletedId));

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("User not found");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MODELS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Models", () => {
  describe("User Model", () => {
    it("creates a user with valid data", async () => {
      const user = await User.create({
        fullName: "Valid User",
        email: "valid@example.com",
        password: "hashedpw",
      });

      expect(user._id).toBeDefined();
      expect(user.fullName).toBe("Valid User");
      expect(user.profilePic).toBe("");
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    it("requires email", async () => {
      await expect(
        User.create({ fullName: "No Email", password: "hashedpw" })
      ).rejects.toThrow();
    });

    it("requires fullName", async () => {
      await expect(
        User.create({ email: "noname@example.com", password: "hashedpw" })
      ).rejects.toThrow();
    });

    it("requires password", async () => {
      await expect(
        User.create({ fullName: "No Pass", email: "nopass@example.com" })
      ).rejects.toThrow();
    });

    it("enforces unique email", async () => {
      await User.create({
        fullName: "First",
        email: "dup@example.com",
        password: "hashedpw",
      });

      await expect(
        User.create({
          fullName: "Second",
          email: "dup@example.com",
          password: "hashedpw",
        })
      ).rejects.toThrow();
    });

    it("defaults profilePic to empty string", async () => {
      const user = await User.create({
        fullName: "Default Pic",
        email: "defpic@example.com",
        password: "hashedpw",
      });

      expect(user.profilePic).toBe("");
    });
  });

  describe("Message Model", () => {
    it("creates a message with valid data", async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();

      const msg = await Message.create({
        senderId: userA._id,
        receiverId: userB._id,
        text: "Test message",
      });

      expect(msg._id).toBeDefined();
      expect(msg.text).toBe("Test message");
      expect(msg.senderId.toString()).toBe(userA._id.toString());
      expect(msg.receiverId.toString()).toBe(userB._id.toString());
      expect(msg.createdAt).toBeDefined();
    });

    it("creates a message with image", async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();

      const msg = await Message.create({
        senderId: userA._id,
        receiverId: userB._id,
        image: "https://example.com/image.jpg",
      });

      expect(msg.image).toBe("https://example.com/image.jpg");
    });

    it("requires senderId", async () => {
      const user = await createTestUser();
      await expect(
        Message.create({ receiverId: user._id, text: "No sender" })
      ).rejects.toThrow();
    });

    it("requires receiverId", async () => {
      const user = await createTestUser();
      await expect(
        Message.create({ senderId: user._id, text: "No receiver" })
      ).rejects.toThrow();
    });

    it("trims whitespace from text", async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();

      const msg = await Message.create({
        senderId: userA._id,
        receiverId: userB._id,
        text: "  padded text  ",
      });

      expect(msg.text).toBe("padded text");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Utilities", () => {
  describe("generateToken", () => {
    it("returns a valid JWT containing userId", () => {
      const userId = new mongoose.Types.ObjectId();
      const mockRes = { cookie: vi.fn() };

      const token = generateToken(userId, mockRes);

      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.userId).toBe(userId.toString());
    });

    it("sets an httpOnly cookie on the response", () => {
      const userId = new mongoose.Types.ObjectId();
      const mockRes = { cookie: vi.fn() };

      generateToken(userId, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        "jwt",
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        })
      );
    });

    it("sets secure=false in development mode", () => {
      const userId = new mongoose.Types.ObjectId();
      const mockRes = { cookie: vi.fn() };

      generateToken(userId, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        "jwt",
        expect.any(String),
        expect.objectContaining({ secure: false })
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  INTEGRATION: FULL AUTH FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe("Integration: Full Auth Flow", () => {
  it("signup → check → update profile → logout → check (rejected)", async () => {
    // 1. Sign up
    const signupRes = await request(app).post("/api/auth/signup").send({
      fullName: "Flow Tester",
      email: "flow@example.com",
      password: "flowtest123",
    });
    expect(signupRes.status).toBe(201);

    // Extract JWT cookie from signup response
    const cookies = signupRes.headers["set-cookie"];
    const jwtCookie = cookies.find((c) => c.startsWith("jwt="));

    // 2. Check auth — should succeed
    const checkRes = await request(app)
      .get("/api/auth/check")
      .set("Cookie", jwtCookie);

    expect(checkRes.status).toBe(200);
    expect(checkRes.body.fullName).toBe("Flow Tester");

    // 3. Update profile
    const updateRes = await request(app)
      .put("/api/auth/update-profile")
      .set("Cookie", jwtCookie)
      .send({ profilePic: "data:image/png;base64,flowpic" });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.profilePic).toBe(
      "https://res.cloudinary.com/test/image/upload/v1/test.jpg"
    );

    // 4. Logout
    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", jwtCookie);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.message).toBe("Logged out successfully");

    // 5. Check auth again — should be rejected (no cookie sent)
    const rejectRes = await request(app).get("/api/auth/check");
    expect(rejectRes.status).toBe(401);
  });
});

describe("Integration: Messaging Flow", () => {
  it("signup two users → send messages → retrieve conversation", async () => {
    // Sign up User 1
    const signup1 = await request(app).post("/api/auth/signup").send({
      fullName: "User One",
      email: "one@example.com",
      password: "password1",
    });
    const cookie1 = signup1.headers["set-cookie"].find((c) => c.startsWith("jwt="));

    // Sign up User 2
    const signup2 = await request(app).post("/api/auth/signup").send({
      fullName: "User Two",
      email: "two@example.com",
      password: "password2",
    });
    const cookie2 = signup2.headers["set-cookie"].find((c) => c.startsWith("jwt="));

    const user2Id = signup2.body._id;

    // User 1 sends a message to User 2
    const sendRes = await request(app)
      .post(`/api/messages/send/${user2Id}`)
      .set("Cookie", cookie1)
      .send({ text: "Hey there!" });

    expect(sendRes.status).toBe(201);

    // User 2 retrieves the conversation
    const user1Id = signup1.body._id;
    const messagesRes = await request(app)
      .get(`/api/messages/${user1Id}`)
      .set("Cookie", cookie2);

    expect(messagesRes.status).toBe(200);
    expect(messagesRes.body).toHaveLength(1);
    expect(messagesRes.body[0].text).toBe("Hey there!");

    // User 2 checks chat partners
    const chatsRes = await request(app)
      .get("/api/messages/chats")
      .set("Cookie", cookie2);

    expect(chatsRes.status).toBe(200);
    expect(chatsRes.body).toHaveLength(1);
    expect(chatsRes.body[0].fullName).toBe("User One");
  });
});
