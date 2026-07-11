import type { NextFunction, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "db";

// supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!,
);

export async function middleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization; // may be bearer + token or token only
  if (!authHeader) {
    return res.status(401).json({ message: "No authorization header" });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  // console.log("exact token:", token);

  try {
    // const response = await supabase.auth.getUser();
    // const user = response.data.user;
    // const error = response.error;

    const { data: { user }, error } = await supabase.auth.getUser(token);
    const address = user?.user_metadata.custom_claims.address;

    // update or insert ( its a comb of update or insert)
    const userDb = await prisma.user.upsert({
      where: {
        address,
      },
      update : {
        address
      },
      create: {
        address,
        usdBalance: 0
      }
    })

    // console.log("user console:", user); // see this log for getiing useer address
    // console.log("user error", error);

    if(address) {
      req.userId = userDb.id;
      next();
    }

    if (error || !user) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  } catch (err) {
    return res.status(403).json({
      message: "Incoreect Credentials",
    });
  }

  next();
}

// export async function middleware(req: Request, res: Response, next: NextFunction) {
//     const authHeader = req.headers.authorization;
//     if (!authHeader) {
//         return res.status(401).json({ message: "No authorization header" });
//     }

//     const token = authHeader.startsWith("Bearer ")
//         ? authHeader.slice(7)
//         : authHeader;

//     const { data: { user }, error } = await supabase.auth.getUser(token);

//     if (error || !user) {
//         return res.status(401).json({ message: "Invalid or expired token" });
//     }

//     (req as any).user = user;
//     next()
// }
