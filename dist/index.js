'use strict';

var express4 = require('@apollo/server/express4');
var module$1 = require('module');
var express = require('express');
var cors = require('cors');
var helmet = require('helmet');
var jwt = require('jsonwebtoken');
var mongoose = require('mongoose');
var rateLimit = require('express-rate-limit');
var server = require('@apollo/server');
var _default = require('@apollo/server/plugin/landingPage/default');
var apolloServerExpress = require('apollo-server-express');
var bcrypt = require('bcryptjs');
var nanoid = require('nanoid');
var geoip = require('geoip-lite');
var dotenv = require('dotenv');
var winston = require('winston');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
var require$1 = (
			false
				? /* @__PURE__ */ module$1.createRequire((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.src || new URL('index.js', document.baseURI).href)))
				: require
		);

const BlacklistedTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  blacklistedAt: { type: Date, default: Date.now }
});
BlacklistedTokenSchema.index({ blacklistedAt: 1 }, { expireAfterSeconds: 86400 });
const BlacklistedToken = mongoose.model("BlacklistedToken", BlacklistedTokenSchema);

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const tokenService = {
  generateToken(userId) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "1d" });
  },
  async verifyToken(token) {
    try {
      const isBlacklisted = await BlacklistedToken.exists({ token });
      if (isBlacklisted) {
        return null;
      }
      const decoded = jwt.verify(token, JWT_SECRET);
      return decoded;
    } catch (error) {
      return null;
    }
  },
  async blacklistToken(token) {
    await BlacklistedToken.create({ token });
  }
};

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  lastLogout: { type: Date, default: null }
});
const User = mongoose.model("User", UserSchema);

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split("Bearer ")[1];
    if (token) {
      const decoded = await tokenService.verifyToken(token);
      if (decoded) {
        const user = await User.findById(decoded.userId);
        if (user) {
          req.user = user;
          req.token = token;
        }
      }
    }
  }
  next();
};

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 5e3,
  // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later"
});

const DeviceDetector = require$1("node-device-detector");
const ClientHints = require$1("node-device-detector/client-hints");
const deviceDetector = new DeviceDetector({
  clientIndexes: true,
  deviceIndexes: true,
  deviceAliasCode: false
});
const clientHints = new ClientHints();
const middlewareDetect = (req, res, next) => {
  const useragent = req.headers["user-agent"];
  const clientHintsData = clientHints.parse(req.headers);
  req.useragent = useragent;
  req.device = deviceDetector.detect(useragent, clientHintsData);
  req.bot = deviceDetector.parseBot(useragent);
  next();
};

const requestIp = require$1("request-ip");
const createExpressApp = () => {
  const app = express();
  app.use(cors({
    origin: ["https://studio.apollographql.com", "http://localhost:4000"],
    credentials: true
  }));
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? void 0 : false,
    crossOriginEmbedderPolicy: false
  }));
  app.use(express.json());
  app.use(authMiddleware);
  app.use(middlewareDetect);
  app.use(requestIp.mw());
  app.use(rateLimiter);
  return app;
};

const typeDefs = apolloServerExpress.gql`
  type User {
    id: ID!
    username: String!
    email: String!
    createdAt: String!
  }

  type Link {
    id: ID!
    originalUrl: String!
    shortUrl: String!
    userId: ID!
    clicks: Int!
    createdAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    me: User
    getUserLinks: [Link!]!
    getLinkAnalytics(linkId: ID!): LinkAnalytics!
  }

  type Mutation {
    register(username: String!, email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    logout(userId: String!, token: String!): Boolean!
    createLink(originalUrl: String!): Link!
    updateLink(id: ID!, originalUrl: String): Link!
    deleteLink(id: ID!): Boolean!
    updateProfile(username: String, email: String): User!
  }

  type LinkAnalytics {
  clicks: Int!
  referrers: [AnalyticItem!]!
  countries: [AnalyticItem!]!
  browsers: [AnalyticItem!]!
  operatingSystems: [AnalyticItem!]!
  deviceTypes: [AnalyticItem!]!
}

type AnalyticItem {
  name: String!
  count: Int!
}
`;

const userService = {
  async register({ username, email, password }) {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      throw new apolloServerExpress.UserInputError("Username or email already exists");
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    const token = tokenService.generateToken(user.id);
    return { token, user };
  },
  async login({ email, password }) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new apolloServerExpress.UserInputError("User not found");
    }
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new apolloServerExpress.UserInputError("Invalid password");
    }
    const token = tokenService.generateToken(user.id);
    return { token, user };
  },
  async logout(userId, token) {
    const user = await User.findById(userId);
    if (!user) {
      throw new apolloServerExpress.UserInputError("User not found");
    }
    user.lastLogout = /* @__PURE__ */ new Date();
    await user.save();
    await tokenService.blacklistToken(token);
    return true;
  },
  async updateProfile(userId, { username, email }) {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { username, email } },
      { new: true, runValidators: true }
    );
    if (!user) {
      throw new apolloServerExpress.UserInputError("User not found");
    }
    return user;
  }
};

const LinkSchema = new mongoose.Schema({
  originalUrl: { type: String, required: true },
  shortUrl: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  clicks: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
const Link = mongoose.model("Link", LinkSchema);

const linkService = {
  async createLink(originalUrl, userId) {
    const shortUrl = nanoid.nanoid(8);
    const link = new Link({ originalUrl, shortUrl, userId });
    await link.save();
    return link;
  },
  async getLinksByUserId(userId) {
    return Link.find({ userId });
  },
  async updateLink(id, originalUrl, userId) {
    const link = await Link.findOneAndUpdate(
      { _id: id, userId },
      { $set: { originalUrl } },
      { new: true, runValidators: true }
    );
    if (!link) {
      throw new apolloServerExpress.UserInputError("Link not found or unauthorized");
    }
    return link;
  },
  async deleteLink(id, userId) {
    const result = await Link.deleteOne({ _id: id, userId });
    return result.deletedCount === 1;
  }
};

const AnalyticsSchema = new mongoose.Schema({
  linkId: { type: mongoose.Schema.Types.ObjectId, ref: "Link", required: true },
  clickDate: { type: Date, default: Date.now },
  ip: String,
  userAgent: String,
  deviceType: String,
  browser: String,
  browserVersion: String,
  os: String,
  osVersion: String,
  deviceVendor: String,
  deviceModel: String,
  referer: String,
  country: String,
  countryCode: String,
  region: String,
  city: String,
  latitude: Number,
  longitude: Number,
  timezone: String,
  eu: String,
  metro: Number,
  area: Number
});
const Analytics = mongoose.model("Analytics", AnalyticsSchema);

dotenv.config();
const appConfig = {
  port: process.env.PORT || 4e3,
  dbName: process.env.DB_NAME,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET || "your_jwt_secret",
  environment: process.env.NODE_ENV || "development",
  logLevel: process.env.LOG_LEVEL || "info",
  redisUrl: process.env.REDIS_URL,
  jwtExpirationInSeconds: process.env.JWT_EXPIRATION_IN_SECONDS || 86400,
  redisHost: process.env.REDIS_HOST,
  redisPort: process.env.REDIS_PORT || 11512,
  redisPassword: process.env.REDIS_PASSWORD,
  testIP: process.env.DEFAULT_TEST_IP
};

function getClientIp(req) {
  const testIp = req.headers["x-test-ip"];
  if (testIp) {
    return testIp;
  }
  const forwardedFor = req.headers["x-forwarded-for"] || "";
  const realIp = req.headers["x-real-ip"];
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((ip2) => ip2.trim());
    return ips[0];
  }
  if (realIp) {
    return realIp;
  }
  const ip = req.ip || req.connection.remoteAddress;
  if (ip === "::1" || ip === "127.0.0.1") {
    return appConfig.testIP || "Unknown";
  }
  return ip || "Unknown";
}

const analyticsService = {
  async getLinkAnalytics(linkId) {
    const link = await Link.findById(linkId);
    if (!link) {
      throw new apolloServerExpress.UserInputError("Link not found");
    }
    const analyticsData = await Analytics.aggregate([
      { $match: { linkId: new mongoose.Types.ObjectId(linkId) } },
      {
        $group: {
          _id: null,
          totalClicks: { $sum: 1 },
          referrers: { $addToSet: "$referer" },
          countries: { $addToSet: "$country" },
          browsers: { $addToSet: { name: "$browser", version: "$browserVersion" } },
          operatingSystems: { $addToSet: { name: "$os", version: "$osVersion" } },
          deviceTypes: { $addToSet: "$deviceType" }
        }
      }
    ]);
    const result = analyticsData[0] || {
      totalClicks: 0,
      referrers: [],
      countries: [],
      browsers: [],
      operatingSystems: [],
      deviceTypes: []
    };
    const aggregateAndSort = (arr) => {
      const counts = arr.reduce((acc, curr) => {
        const key = curr || "Unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    };
    const aggregateBrowsersAndOS = (arr) => {
      const counts = arr.reduce((acc, curr) => {
        const key = `${curr.name || "Unknown"} ${curr.version || ""}`.trim();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    };
    return {
      clicks: result.totalClicks,
      referrers: aggregateAndSort(result.referrers),
      countries: aggregateAndSort(result.countries),
      browsers: aggregateBrowsersAndOS(result.browsers),
      operatingSystems: aggregateBrowsersAndOS(result.operatingSystems),
      deviceTypes: aggregateAndSort(result.deviceTypes)
    };
  },
  async findAndUpdateLink(shortUrl) {
    return Link.findOneAndUpdate(
      {
        $or: [
          { shortUrl },
          { customShortUrl: shortUrl },
          { expiresAt: { $gt: /* @__PURE__ */ new Date() } },
          { expiresAt: null }
        ]
      },
      { $inc: { clicks: 1 } },
      { new: true }
    );
  },
  async saveAnalytics(linkId, req) {
    try {
      const ip = getClientIp(req);
      const userAgent = req.headers["user-agent"] || "Unknown";
      const referer = req.headers.referer || req.headers.referrer || "Direct";
      const geoData = geoip.lookup(ip);
      let device = req.device.device.type || "Unknown";
      const analyticsData = {
        linkId,
        clickDate: /* @__PURE__ */ new Date(),
        ip,
        userAgent,
        deviceType: device,
        browser: req.device.client.name || "Other",
        browserVersion: req.device.client.version || "Unknown",
        os: req.device.os.name || "Other",
        osVersion: req.device.os.version || "Unknown",
        deviceVendor: req.device.device.brand || "Unknown",
        deviceModel: req.device.device.model || "Unknown",
        referer,
        country: geoData?.country || "Unknown",
        countryCode: geoData?.country || "Unknown",
        region: geoData?.region || "Unknown",
        city: geoData?.city || "Unknown",
        latitude: geoData?.ll[0] || null,
        longitude: geoData?.ll[1] || null,
        timezone: geoData?.timezone || "Unknown",
        eu: geoData?.eu === "1" ? "Yes" : "No",
        metro: geoData?.metro || null,
        area: geoData?.area || null
      };
      await Analytics.create(analyticsData);
    } catch (err) {
      console.error("Error saving analytics data:", err);
    }
  }
};

const validateRegisterInput = ({ username, email, password }) => {
  const errors = {};
  if (username.trim() === "") {
    errors.username = "Username must not be empty";
  }
  if (email.trim() === "") {
    errors.email = "Email must not be empty";
  } else {
    const regEx = /^([0-9a-zA-Z]([-.\w]*[0-9a-zA-Z])*@([0-9a-zA-Z][-\w]*[0-9a-zA-Z]\.)+[a-zA-Z]{2,9})$/;
    if (!email.match(regEx)) {
      errors.email = "Email must be a valid email address";
    }
  }
  if (password === "") {
    errors.password = "Password must not be empty";
  } else if (password.length < 6) {
    errors.password = "Password must be at least 6 characters long";
  }
  return {
    errors,
    valid: Object.keys(errors).length < 1
  };
};
const validateLoginInput = ({ email, password }) => {
  const errors = {};
  if (email.trim() === "") {
    errors.email = "Email must not be empty";
  }
  if (password === "") {
    errors.password = "Password must not be empty";
  }
  return {
    errors,
    valid: Object.keys(errors).length < 1
  };
};
const validateLinkInput = ({ originalUrl }) => {
  const errors = {};
  if (originalUrl.trim() === "") {
    errors.originalUrl = "URL must not be empty";
  } else {
    try {
      new URL(originalUrl);
    } catch (error) {
      errors.originalUrl = "Invalid URL format";
    }
  }
  return {
    errors,
    valid: Object.keys(errors).length < 1
  };
};

const resolvers = {
  Query: {
    me: async (_, __, context) => {
      if (!context.user) throw new apolloServerExpress.AuthenticationError("Not authenticated");
      return context.user;
    },
    getUserLinks: async (_, __, { user }) => {
      if (!user) throw new apolloServerExpress.AuthenticationError("Not authenticated");
      return linkService.getLinksByUserId(user.id);
    },
    getLinkAnalytics: async (_, { linkId }, { user }) => {
      if (!user) throw new apolloServerExpress.AuthenticationError("Not authenticated");
      return analyticsService.getLinkAnalytics(linkId);
    }
  },
  Mutation: {
    register: async (_, args) => {
      const { errors, valid } = validateRegisterInput(args);
      if (!valid) throw new apolloServerExpress.UserInputError("Invalid input", { errors });
      return userService.register(args);
    },
    login: async (_, args) => {
      const { errors, valid } = validateLoginInput(args);
      if (!valid) throw new apolloServerExpress.UserInputError("Invalid input", { errors });
      return userService.login(args);
    },
    logout: async (_, __, { user, token }) => {
      if (!user || !token) throw new apolloServerExpress.AuthenticationError("Not authenticated");
      return userService.logout(user.id, token);
    },
    createLink: async (_, { originalUrl }, { user }) => {
      if (!user) throw new apolloServerExpress.AuthenticationError("Not authenticated");
      const { errors, valid } = validateLinkInput({ originalUrl });
      if (!valid) throw new apolloServerExpress.UserInputError("Invalid input", { errors });
      return linkService.createLink(originalUrl, user.id);
    },
    updateLink: async (_, { id, originalUrl }, { user }) => {
      if (!user) throw new apolloServerExpress.AuthenticationError("Not authenticated");
      if (originalUrl) {
        const { errors, valid } = validateLinkInput({ originalUrl });
        if (!valid) throw new apolloServerExpress.UserInputError("Invalid input", { errors });
      }
      return linkService.updateLink(id, originalUrl, user.id);
    },
    deleteLink: async (_, { id }, { user }) => {
      if (!user) throw new apolloServerExpress.AuthenticationError("Not authenticated");
      return linkService.deleteLink(id, user.id);
    },
    updateProfile: async (_, args, { user }) => {
      if (!user) throw new apolloServerExpress.AuthenticationError("Not authenticated");
      return userService.updateProfile(user.id, args);
    }
  }
};

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" })
  ]
});

const createApolloServer = () => {
  return new server.ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
    // Enable introspection for Sandbox
    plugins: [_default.ApolloServerPluginLandingPageLocalDefault({ embed: true })],
    formatError: (error) => {
      logger.error("GraphQL Error:", error);
      return error;
    }
  });
};
const createApolloContext = async ({ req }) => {
  return {
    user: req.user
  };
};

const connectDB = async () => {
  try {
    mongoose.connect(appConfig.mongoUri);
    logger.info(`Connected to MongoDB Name: ${appConfig.dbName}`);
  } catch (error) {
    logger.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

class LinkController {
  static async redirectShortUrl(req, res) {
    const { shortUrl } = req.params;
    try {
      const url = await analyticsService.findAndUpdateLink(shortUrl);
      if (url) {
        analyticsService.saveAnalytics(url._id, req).catch((err) => {
          console.error("Error saving analytics:", err);
        });
        res.redirect(url.originalUrl);
      } else {
        res.status(404).send("Short URL not found");
      }
    } catch (error) {
      console.error("Error processing short URL:", error);
      res.status(500).send("An error occurred");
    }
  }
}

async function startServer() {
  try {
    await connectDB();
    const app = createExpressApp();
    const apolloServer = createApolloServer();
    await apolloServer.start();
    app.use(
      "/graphql",
      express4.expressMiddleware(apolloServer, {
        context: createApolloContext
      })
    );
    app.get("/:shortUrl", LinkController.redirectShortUrl);
    app.listen(appConfig.port, () => {
      logger.info(`Server running on http://localhost:${appConfig.port}/graphql`);
      logger.info("Apollo Sandbox available at the above URL");
    });
  } catch (error) {
    logger.error("Error starting server:", error);
    process.exit(1);
  }
}
startServer();
