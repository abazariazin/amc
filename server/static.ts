import express, { type Express } from "express";
import fs from "fs";
import path from "path";

// For CommonJS bundle, use process.cwd() as base since __dirname won't be available
// The dist/public folder will be relative to where the server.cjs file is located
const getDistPath = () => {
  // Try to use __dirname if available (CommonJS), otherwise use process.cwd()
  const baseDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  // If we're in dist folder (bundled), go up one level, otherwise assume we're in root
  const distPath = baseDir.includes('dist') 
    ? path.resolve(baseDir, "public")
    : path.resolve(baseDir, "dist/public");
  return distPath;
};

export function serveStatic(app: Express) {
  const distPath = getDistPath();
  if (!fs.existsSync(distPath)) {
    console.error(`Warning: Build directory not found at ${distPath}`);
    return;
  }

  app.use(express.static(distPath));

  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
