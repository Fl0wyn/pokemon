import mongoose from "mongoose";
import { debugApiEnabled, debugApiLog } from "./debugApi";

mongoose.connection.on("connecting", () => {
  debugApiLog("MongoDB: connexion en cours…");
});

mongoose.connection.on("connected", () => {
  const c = mongoose.connection;
  debugApiLog(
    "MongoDB: connecté",
    `host=${c.host}`,
    `db=${c.name}`,
    `readyState=${c.readyState}`,
  );
});

mongoose.connection.on("disconnected", () => {
  debugApiLog("MongoDB: déconnecté");
});

mongoose.connection.on("error", (err) => {
  console.error("[MongoDB] erreur:", err?.message ?? err);
});

const connectDB = async () => {
  try {
    const mongoUser = process.env.MONGO_USER;
    const mongoPassword = process.env.MONGO_PASSWORD;
    const mongoIp = process.env.MONGO_IP || "localhost";
    const mongoPort = process.env.MONGO_PORT || "27017";
    const mongoDb = process.env.MONGO_DB || "test";

    // Build connection string with or without authentication
    let connectionString = "mongodb://";

    if (mongoUser && mongoPassword) {
      // Include credentials if provided
      connectionString += `${mongoUser}:${mongoPassword}@`;
    }

    connectionString += `${mongoIp}:${mongoPort}/${mongoDb}`;

    // Add authSource only if credentials are provided
    if (mongoUser && mongoPassword) {
      connectionString += "?authSource=admin";
    }

    const conn = await mongoose.connect(connectionString, {});

    console.log("MongoDB is connected on " + conn.connection.host);
    if (debugApiEnabled()) {
      debugApiLog("Chaîne (sans mot de passe):", connectionString.replace(/:[^:@]+@/, ":****@"));
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
  }
};

export default connectDB;
