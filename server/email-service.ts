import nodemailer, { type Transporter } from "nodemailer";
import type { storage } from "./storage";

let transporter: Transporter | null = null;

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  authUser: string;
  authPass: string;
  fromEmail: string;
  fromName: string;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  variables?: string[];
}

export async function initializeEmailService(config: EmailConfig | null): Promise<boolean> {
  if (!config || !config.host || !config.authUser || !config.authPass) {
    transporter = null;
    console.warn("Email service initialization skipped: missing configuration");
    return false;
  }

  try {
    // Log what we're using (WITH password for debugging)
    console.log("Initializing email service with:", {
      host: config.host,
      port: config.port,
      secure: config.secure,
      authUser: config.authUser,
      authPass: config.authPass || "MISSING",
      authPassLength: config.authPass?.length || 0,
    });
    
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.authUser,
        pass: config.authPass,
      },
      // Add connection timeout settings
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    console.log("Transporter created, verifying connection...");
    
    // Verify connection with timeout
    await Promise.race([
      transporter.verify(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Connection timeout after 10 seconds")), 10000)
      )
    ]);
    
    console.log(`✓ Email service initialized successfully for ${config.host}:${config.port}`);
    return true;
  } catch (error: any) {
    const errorMessage = error.message || error.toString();
    console.error(`✗ Failed to initialize email service for ${config.host}:${config.port}:`, errorMessage);
    console.error("Error details:", {
      host: config.host,
      port: config.port,
      secure: config.secure,
      authUser: config.authUser,
      authPassLength: config.authPass?.length || 0,
      error: errorMessage,
    });
    
    // Provide more helpful error messages
    if (errorMessage.includes("ETIMEDOUT") || errorMessage.includes("timeout")) {
      console.error(`→ Connection timeout: Check if port ${config.port} is correct and not blocked by firewall`);
    } else if (errorMessage.includes("ECONNREFUSED")) {
      console.error(`→ Connection refused: Check if SMTP host ${config.host} is correct`);
    } else if (errorMessage.includes("EAUTH")) {
      console.error(`→ Authentication failed: Check username and password are correct`);
      console.error(`  Username: ${config.authUser}`);
      console.error(`  Password length: ${config.authPass?.length || 0}`);
    }
    
    transporter = null;
    return false;
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  textBody?: string,
  fromEmail?: string,
  fromName?: string
): Promise<boolean> {
  if (!transporter) {
    console.warn("Email service not configured");
    return false;
  }

  try {
    await transporter.sendMail({
      from: fromEmail ? `"${fromName || 'American Coin'}" <${fromEmail}>` : undefined,
      to,
      subject,
      html: htmlBody,
      text: textBody || htmlBody.replace(/<[^>]*>/g, ""), // Strip HTML for text version
    });
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  console.log("Replacing template variables:", Object.keys(variables));
  
  // First, unescape any escaped braces (convert \{\{ to {{ and \}\} to }})
  result = result.replace(/\\\{\{/g, "{{").replace(/\\\}\}/g, "}}");
  
  // Ensure all values are strings
  const stringVariables: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    stringVariables[key] = String(value || "");
  }
  
  for (const [key, value] of Object.entries(stringVariables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    const beforeReplace = result;
    result = result.replace(regex, value);
    if (beforeReplace !== result) {
      console.log(`✓ Replaced {{${key}}} in template`);
    } else {
      // Check if variable exists in template but wasn't replaced
      if (template.includes(`{{${key}}}`) || template.includes(`{{ ${key} }}`)) {
        console.log(`⚠ {{${key}}} found in template but replacement may have failed`);
      }
    }
  }
  
  // Log if seedPhrase was replaced
  if (variables.seedPhrase) {
    const seedPhraseFound = result.includes(String(variables.seedPhrase));
    console.log(`Seed phrase replacement check: ${seedPhraseFound ? "✓ Found in result" : "✗ Not found in result"}`);
  }
  
  // Check for any unreplaced variables
  const unreplacedMatches = result.match(/{{[^}]+}}/g);
  if (unreplacedMatches && unreplacedMatches.length > 0) {
    console.warn("⚠ Unreplaced template variables found:", unreplacedMatches);
  }
  
  return result;
}

export function getDefaultAccountConfirmationTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px 12px 0 0;">
              <div style="width: 80px; height: 80px; margin: 0 auto 20px; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px; color: #ffffff;"></span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">American Coin</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">Welcome, {{name}}!</h2>
              
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Your American Coin wallet account has been successfully created. You can now securely manage your cryptocurrency portfolio.
              </p>
              
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h3 style="margin: 0 0 15px; color: #1f2937; font-size: 18px; font-weight: 600;">Account Details</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Name:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">{{name}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">{{email}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Wallet:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 12px; font-family: monospace; word-break: break-all;">{{walletAddress}}</td>
                  </tr>
                </table>
              </div>
              
              <!-- Seed Phrase Section - CRITICAL -->
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 3px solid #f59e0b; border-radius: 12px; padding: 25px; margin: 30px 0; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);">
                <div style="text-align: center; margin-bottom: 20px;">
                  <div style="display: inline-block; background-color: #f59e0b; color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                    🔐 Critical Information
                  </div>
                </div>
                <h3 style="margin: 0 0 15px; color: #92400e; font-size: 20px; font-weight: 700; text-align: center;">
                  ⚠️ Your Seed Phrase (SAVE THIS NOW!)
                </h3>
                <p style="margin: 0 0 20px; color: #78350f; font-size: 15px; line-height: 1.7; text-align: center; font-weight: 500;">
                  <strong style="color: #b45309; font-size: 16px;">CRITICAL:</strong> This is your secret recovery phrase. Write it down immediately and store it in a safe, offline location. <strong>You will NOT be able to recover your wallet without it.</strong>
                </p>
                <div style="background-color: #ffffff; border-radius: 8px; padding: 20px; border: 2px solid #f59e0b; margin: 20px 0; box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);">
                  <p style="margin: 0; color: #1f2937; font-size: 15px; font-family: 'Courier New', monospace; line-height: 2; word-break: break-word; text-align: center; font-weight: 600; letter-spacing: 0.5px;">
                    {{seedPhrase}}
                  </p>
                </div>
                <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 6px;">
                  <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6; font-weight: 600;">
                    🚨 SECURITY WARNING:
                  </p>
                  <ul style="margin: 10px 0 0 20px; padding: 0; color: #991b1b; font-size: 13px; line-height: 1.8;">
                    <li>Never share your seed phrase with anyone</li>
                    <li>American Coin staff will NEVER ask for your seed phrase</li>
                    <li>Do not store it digitally (screenshots, cloud storage, etc.)</li>
                    <li>Write it down on paper and store it securely offline</li>
                    <li>Anyone with your seed phrase can access your wallet</li>
                  </ul>
                </div>
                <p style="margin: 20px 0 0; color: #78350f; font-size: 13px; line-height: 1.6; text-align: center; font-style: italic;">
                  This seed phrase is the master key to your wallet. Protect it like you would protect cash or jewelry.
                </p>
              </div>
              
              <p style="margin: 30px 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                <strong>Important Security Information:</strong><br>
                Your seed phrase is securely stored and encrypted. Please keep it safe and never share it with anyone.
              </p>
              
              <div style="text-align: center; margin: 40px 0 20px;">
                <a href="{{appUrl}}" style="display: inline-block; padding: 14px 32px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Access Your Wallet</a>
              </div>
              
              <p style="margin: 30px 0 0; color: #9ca3af; font-size: 14px; line-height: 1.6; text-align: center;">
                If you did not create this account, please contact support immediately.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
                &copy; 2025 American Coin. All rights reserved.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Secure Wallet v1.0 | Bank-Grade Security
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendDailyBalanceEmails(storage: any): Promise<void> {
  try {
    const emailConfig = await storage.getEmailConfig();
    if (!emailConfig || !emailConfig.host) {
      console.log("Email service not configured. Skipping daily balance emails.");
      return;
    }

    // Ensure email service is initialized
    const initialized = await initializeEmailService({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure === 1,
      authUser: emailConfig.authUser,
      authPass: emailConfig.authPass,
      fromEmail: emailConfig.fromEmail,
      fromName: emailConfig.fromName,
    });

    if (!initialized) {
      console.error("Failed to initialize email service for daily balance emails");
      return;
    }

    // Get all users
    const users = await storage.getAllUsers();
    
    // Get AMC token config for current and previous price
    const amcConfig = await storage.getTokenConfig("AMC");
    if (!amcConfig) {
      console.error("AMC token config not found. Cannot send daily balance emails.");
      return;
    }

    const currentPrice = parseFloat(amcConfig.currentPrice);
    const basePrice = parseFloat(amcConfig.basePrice);
    const previousPrice = basePrice; // For simplicity, using base price as previous
    const priceIncrease = basePrice > 0 ? ((currentPrice - basePrice) / basePrice) * 100 : 0;

    // Get template
    let template = await storage.getEmailTemplate("daily_balance");
    let htmlTemplate = template?.htmlBody || getDefaultDailyBalanceTemplate();
    const subject = template?.subject || "Daily AMC Balance Update - American Coin";

    let emailsSent = 0;
    let emailsFailed = 0;

    for (const user of users) {
      try {
        // Get user's AMC balance
        const amcAsset = await storage.getUserAsset(user.id, "AMC");
        const amcBalance = amcAsset ? parseFloat(amcAsset.balance) : 0;
        const balanceUSD = amcBalance * currentPrice;
        const valueIncrease = amcBalance * (currentPrice - basePrice);

        // Get email config for appUrl
        const emailConfig = await storage.getEmailConfig();
        const appUrl = emailConfig?.appUrl || process.env.APP_URL || "https://americancoin.app";
        
        // Replace template variables
        const htmlBody = replaceTemplateVariables(htmlTemplate, {
          name: user.name,
          email: user.email,
          walletAddress: user.walletAddress,
          amcBalance: amcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }),
          balanceUSD: balanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          currentPrice: currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }),
          previousPrice: previousPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }),
          priceIncrease: priceIncrease.toFixed(2),
          valueIncrease: valueIncrease.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          date: new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
          appUrl: appUrl,
        });

        const emailSent = await sendEmail(
          user.email,
          subject,
          htmlBody,
          undefined,
          emailConfig.fromEmail,
          emailConfig.fromName
        );

        if (emailSent) {
          emailsSent++;
          console.log(`Daily balance email sent to ${user.email}`);
        } else {
          emailsFailed++;
          console.error(`Failed to send daily balance email to ${user.email}`);
        }
      } catch (error: any) {
        emailsFailed++;
        console.error(`Error sending daily balance email to ${user.email}:`, error.message);
      }
    }

    console.log(`Daily balance emails completed: ${emailsSent} sent, ${emailsFailed} failed`);
  } catch (error: any) {
    console.error("Error in sendDailyBalanceEmails:", error);
  }
}

export function getDefaultDailyBalanceTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Balance Update</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px 12px 0 0;">
              <div style="width: 80px; height: 80px; margin: 0 auto 20px; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px; color: #ffffff;"></span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">American Coin</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">Daily Balance Update, \{\{name\}\}!</h2>
              
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Here's your daily American Coin (AMC) balance update and price increase information.
              </p>
              
              <!-- AMC Balance Section -->
              <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 2px solid #3b82f6; border-radius: 12px; padding: 25px; margin: 30px 0; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);">
                <div style="text-align: center; margin-bottom: 20px;">
                  <div style="display: inline-block; background-color: #3b82f6; color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                    💰 Your AMC Balance
                  </div>
                </div>
                <div style="text-align: center; margin: 20px 0;">
                  <p style="margin: 0 0 10px; color: #1e40af; font-size: 14px; font-weight: 600;">Current AMC Balance</p>
                  <p style="margin: 0; color: #1f2937; font-size: 32px; font-weight: 700; font-family: 'Courier New', monospace;">
                    \{\{amcBalance\}\} AMC
                  </p>
                  <p style="margin: 10px 0 0; color: #4b5563; font-size: 16px;">
                    ≈ $\{\{balanceUSD\}\}
                  </p>
                </div>
              </div>
              
              <!-- Price Increase Section -->
              <div style="background-color: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; padding: 25px; margin: 30px 0; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);">
                <div style="text-align: center; margin-bottom: 20px;">
                  <div style="display: inline-block; background-color: #22c55e; color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                    📈 Price Update
                  </div>
                </div>
                <div style="background-color: #ffffff; border-radius: 8px; padding: 20px; margin: 20px 0;">
                  <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 50%;">Current AMC Price:</td>
                      <td style="padding: 8px 0; color: #1f2937; font-size: 16px; font-weight: 600; text-align: right;">$\{\{currentPrice\}\}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Previous Price:</td>
                      <td style="padding: 8px 0; color: #6b7280; font-size: 14px; text-align: right;">$\{\{previousPrice\}\}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Price Increase:</td>
                      <td style="padding: 8px 0; color: #22c55e; font-size: 16px; font-weight: 700; text-align: right;">+\{\{priceIncrease\}\}%</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Value Increase:</td>
                      <td style="padding: 8px 0; color: #22c55e; font-size: 16px; font-weight: 700; text-align: right;">+$\{\{valueIncrease\}\}</td>
                    </tr>
                  </table>
                </div>
                <p style="margin: 20px 0 0; color: #166534; font-size: 14px; line-height: 1.6; text-align: center; font-style: italic;">
                  Your AMC holdings continue to grow in value! 🚀
                </p>
              </div>
              
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h3 style="margin: 0 0 15px; color: #1f2937; font-size: 18px; font-weight: 600;">Account Summary</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Name:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">\{\{name\}\}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">\{\{email\}\}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Wallet:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 12px; font-family: monospace; word-break: break-all;">\{\{walletAddress\}\}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">\{\{date\}\}</td>
                  </tr>
                </table>
              </div>
              
              <p style="margin: 30px 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Thank you for being part of the American Coin community. Your investment continues to grow!
              </p>
              
              <div style="text-align: center; margin: 40px 0 20px;">
                <a href="\{\{appUrl\}\}" style="display: inline-block; padding: 14px 32px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Your Wallet</a>
              </div>
              
              <p style="margin: 30px 0 0; color: #9ca3af; font-size: 14px; line-height: 1.6; text-align: center;">
                This is an automated daily update. If you have any questions, please contact support.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
                &copy; 2025 American Coin. All rights reserved.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Secure Wallet v1.0 | Bank-Grade Security
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

