import passport from "passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import passportLocal from "passport-local";

import { NextFunction, Request, Response } from "express";

import { Code } from "./../models/Code";

const jwtSecret = process.env.JWT_SECRET || process.env.JWTSECRET;
if (!jwtSecret) {
  throw new Error("JWT_SECRET or JWTSECRET environment variable is required");
}

passport.use(
  new Strategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("JWT"),
      secretOrKey: jwtSecret,
    },
    (payload, done) => {
      /*User.findById(payload.userEmail, (err: NativeError, user : UserDocument) => {
		if (err){
			return done(err, false);
		}else{
			done(null, user);
		}
	});*/
      return done(null, payload.userEmail);
    },
  ),
);

export const basic = function () {
  const LocalStrategy = passportLocal.Strategy;

  passport.use(
    new LocalStrategy(
      {
        usernameField: "login",
        passwordField: "password",
      },
      async (email, password, done) => {
        //console.log("localStrategy")

        let lastCode = await Code.findOne({ code: password })
          .sort({ createdAt: -1 })
          .exec();

        console.log(lastCode);

        if (lastCode) {
          return done(undefined, email);
        }

        // return done(undefined, false, { message: "Invalid email or password." });
      },
    ),
  );
};

export const isAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
};
