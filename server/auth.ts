import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import MemoryStore from "memorystore";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week

  // Use database session store if DATABASE_URL is available, otherwise use memory store
  let sessionStore;
  if (process.env.DATABASE_URL) {
    const pgStore = connectPg(session);
    sessionStore = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: sessionTtl,
      tableName: "sessions",
    });
  } else {
    // Use memory store for local development
    const MemStore = MemoryStore(session);
    sessionStore = new MemStore({
      checkPeriod: sessionTtl
    });
  }

  // Generate a session secret if not provided
  const sessionSecret = process.env.SESSION_SECRET || 'dev-secret-' + Math.random().toString(36).substring(7);

  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true if using HTTPS
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // Auto-login middleware - creates a default user session
  app.use((req, res, next) => {
    if (!req.isAuthenticated()) {
      const mockUser = {
        claims: {
          sub: 'local-dev-user',
          email: 'dev@localhost',
          first_name: 'Local',
          last_name: 'Developer',
          profile_image_url: ''
        },
        access_token: 'local-dev-token',
        refresh_token: null,
        expires_at: Math.floor(Date.now() / 1000) + 86400 // 24 hours from now
      };
      req.login(mockUser, (err) => {
        if (err) return next(err);
        next();
      });
    } else {
      next();
    }
  });

  // Simple login/logout routes
  app.get("/api/login", (req, res) => {
    res.redirect("/");
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/");
    });
  });

  console.log('✅ Simple session-based authentication enabled');
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};
