import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function requireAuth(req, res, next) {
  // Prefer session-based auth (Passport sets req.user). Fallback to JWT.
  if (req.user) return next();

  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      restaurantId: payload.restaurantId,
      isStaff: payload.isStaff || false,     
      staffId: payload.staffId || null,      
    };
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

export function requireRole(...roles) {
  const normalizedRoles = roles.map(r => r.toLowerCase());
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!normalizedRoles.includes(req.user.role?.toLowerCase())) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}

export function requireRestaurantOwnership(req, res, next) {
  const { restaurantId } = req.params;
  const user = req.user;

  // Platform admins can access any restaurant's data
  if (user?.role === "platform_admin") {
    return next();
  }

  // BUG-2 FIX: Reject if user has no restaurantId — prevents a user with
  // no restaurant association from accessing any restaurant endpoint by
  // coincidence (the old code only checked if restaurantId was set AND mismatched;
  // if it was null/undefined, the check was skipped entirely).
  if (!user?.restaurantId) {
    return res.status(403).json({
      message: "Forbidden: No restaurant association on your account",
    });
  }

  // If the user belongs to a specific restaurant, ensure it matches the route
  if (user.restaurantId !== restaurantId) {
    return res.status(403).json({ 
      message: "Forbidden: You do not have permission to access data for this restaurant" 
    });
  }

  next();
}
