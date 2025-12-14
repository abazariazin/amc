import nodemailer from "nodemailer";

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
  if (!config || !config.host) {
    console.log("Email service not configured. Skipping initialization.");
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.authUser,
        pass: config.authPass,
      },
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates
      },
    });

    // Verify connection
    console.log("Transporter created, verifying connection...");
    await transporter.verify();
    console.log(`✓ Email service initialized successfully for ${config.host}:${config.port}`);
    
    // Store transporter globally (in a simple way)
    (global as any).emailTransporter = transporter;
    (global as any).emailConfig = config;
    
    return true;
  } catch (error: any) {
    console.error("Failed to initialize email service:", error.message);
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
  try {
    const transporter = (global as any).emailTransporter;
    const config = (global as any).emailConfig;
    
    if (!transporter || !config) {
      console.error("Email service not initialized");
      return false;
    }

    const mailOptions = {
      from: `"${fromName || config.fromName}" <${fromEmail || config.fromEmail}>`,
      to,
      subject,
      html: htmlBody,
      text: textBody,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✓ Email sent to ${to}`);
    return true;
  } catch (error: any) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export function maskSeedPhrase(seedPhrase: string): string {
  const words = seedPhrase.trim().split(/\s+/);
  if (words.length !== 12) {
    return seedPhrase;
  }
  
  // Show first 2 words fully, mask middle 8 words completely, show last 2 words fully
  // Example: "stool egg **** **** **** **** **** **** ******** **** pistol unhappy"
  const maskedWords = words.map((word, index) => {
    if (index < 2) {
      // First 2 words: show fully
      return word;
    } else if (index >= 10) {
      // Last 2 words: show fully
      return word;
    } else {
      // Middle 8 words: mask completely with asterisks
      // Use 4 asterisks for most words, but for longer words use more
      return '*'.repeat(Math.max(4, word.length));
    }
  });
  
  return maskedWords.join(' ');
}

export function formatSeedPhrase(seedPhrase: string): string {
  // seedPhrase can be either masked or unmasked - just format whatever is passed
  const words = seedPhrase.trim().split(/\s+/);
  if (words.length !== 12) {
    // If not 12 words, return as plain text
    return seedPhrase;
  }
  
  // Format as numbered grid: 3 columns x 4 rows using table rows
  let formatted = '';
  for (let i = 0; i < 12; i += 3) {
    formatted += '<tr>';
    for (let j = 0; j < 3 && (i + j) < 12; j++) {
      const num = i + j + 1;
      const word = words[i + j];
      formatted += `<td style="padding: 10px 8px; border: 1px solid #f59e0b; background-color: #fffbeb; text-align: center; font-size: 14px; font-weight: 600; color: #78350f; font-family: 'Courier New', monospace; border-radius: 4px; width: 33.33%;">
        <span style="color: #92400e; font-size: 11px; margin-right: 4px;">${num}.</span><span style="color: #78350f;">${word}</span>
      </td>`;
    }
    formatted += '</tr>';
  }
  return formatted;
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
  
  // Special handling for seedPhrase - format it nicely (masked for emails)
  // IMPORTANT: Never replace {{seedPhrase}} with unmasked version - only use masked versions
  if (stringVariables.seedPhrase && stringVariables.seedPhrase.trim()) {
    // For account creation emails, use masked version (show first 2 and last 2 words)
    const maskedSeedPhrase = maskSeedPhrase(stringVariables.seedPhrase);
    const formattedSeedPhrase = formatSeedPhrase(maskedSeedPhrase);
    stringVariables.seedPhraseFormatted = formattedSeedPhrase;
    // Also provide masked plain text version
    stringVariables.seedPhraseMasked = maskedSeedPhrase;
    // Replace seedPhrase variable with masked version to prevent unmasked seed phrase from appearing
    stringVariables.seedPhrase = maskedSeedPhrase;
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
  
  // Verify no unmasked seed phrase leaked through
  if (variables.seedPhrase && typeof variables.seedPhrase === 'string') {
    const originalSeedPhrase = variables.seedPhrase.trim();
    const seedPhraseFound = result.includes(originalSeedPhrase);
    if (seedPhraseFound) {
      console.error(`⚠ SECURITY WARNING: Unmasked seed phrase found in email template!`);
    } else {
      console.log(`✓ Seed phrase properly masked in email template`);
    }
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
                <span style="font-size: 40px; color: #ffffff;">🛡️</span>
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
                  <strong style="color: #b45309; font-size: 16px;">CRITICAL:</strong> This is your secret recovery phrase. <strong>For security, only a preview is shown here.</strong> To view your complete seed phrase, click "Access Your Wallet" and use the "View Seed Phrase" option in the app menu after verifying your identity.
                </p>
                <div style="background-color: #ffffff; border-radius: 8px; padding: 20px; border: 2px solid #f59e0b; margin: 20px 0; box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);">
                  <p style="margin: 0 0 15px; color: #92400e; font-size: 12px; font-weight: 600; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">
                    🔒 Preview (Masked for Security)
                  </p>
                  <table role="presentation" style="width: 100%; border-collapse: separate; border-spacing: 8px;">
                    {{seedPhraseFormatted}}
                  </table>
                  <p style="margin: 15px 0 0; color: #78350f; font-size: 12px; text-align: center; font-style: italic;">
                    Only first 2 and last 2 words are shown. Middle words are masked for security. Full phrase available in app after verification.
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
                <a href="{{accessUrl}}" style="display: inline-block; padding: 14px 32px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Access Your Wallet</a>
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
      console.log("Email service initialization failed. Skipping daily balance emails.");
      return;
    }

    const users = await storage.getAllUsers();
    const tokenPrices = await storage.getTokenPrices();
    const amcPrice = tokenPrices["AMC"]?.price || 0;
    const previousPrice = parseFloat((await storage.getTokenConfig("AMC"))?.basePrice || "0");

    if (amcPrice === 0) {
      console.log("AMC price not available. Skipping daily balance emails.");
      return;
    }

    const priceIncrease = amcPrice - previousPrice;
    const priceIncreasePercent = previousPrice > 0 ? (priceIncrease / previousPrice) * 100 : 0;

    for (const user of users) {
      try {
        const assets = await storage.getUserAssets(user.id);
        const amcAsset = assets.find((a: any) => a.symbol === "AMC");
        
        if (!amcAsset) continue;

        const amcBalance = parseFloat(amcAsset.balance);
        const balanceUSD = amcBalance * amcPrice;
        const valueIncrease = amcBalance * priceIncrease;

        if (amcBalance <= 0) continue;

        let template = await storage.getEmailTemplate("daily_balance");
        let htmlTemplate = template?.htmlBody || getDefaultDailyBalanceTemplate();
        const subject = template?.subject || "Daily AMC Balance Update - American Coin";
        const appUrl = emailConfig.appUrl || process.env.APP_URL || "https://americancoin.app";

        const htmlBody = replaceTemplateVariables(htmlTemplate, {
          name: user.name,
          email: user.email,
          walletAddress: user.walletAddress,
          amcBalance: amcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }),
          balanceUSD: balanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          currentPrice: amcPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }),
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
          console.log(`✓ Daily balance email sent to ${user.email}`);
        } else {
          console.error(`✗ Failed to send daily balance email to ${user.email}`);
        }
      } catch (error: any) {
        console.error(`Error sending daily balance email to ${user.email}:`, error.message);
      }
    }
  } catch (error: any) {
    console.error("Error in sendDailyBalanceEmails:", error.message);
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
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px 12px 0 0;">
              <div style="width: 80px; height: 80px; margin: 0 auto 20px; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px; color: #ffffff;">📊</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Daily Balance Update</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">Hello, {{name}}!</h2>
              <p style="margin: 0 0 30px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Here's your daily American Coin (AMC) balance update for {{date}}.
              </p>
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 25px; margin: 30px 0;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <p style="margin: 0; color: #6b7280; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your AMC Balance</p>
                  <p style="margin: 10px 0 0; color: #1f2937; font-size: 32px; font-weight: 700;">{{amcBalance}} AMC</p>
                  <p style="margin: 5px 0 0; color: #6b7280; font-size: 18px;">${{balanceUSD}} USD</p>
                </div>
              </div>
              <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 30px 0; border-radius: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <span style="color: #065f46; font-size: 14px; font-weight: 600;">Current Price:</span>
                  <span style="color: #065f46; font-size: 18px; font-weight: 700;">${{currentPrice}}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <span style="color: #065f46; font-size: 14px; font-weight: 600;">Previous Price:</span>
                  <span style="color: #065f46; font-size: 18px; font-weight: 700;">${{previousPrice}}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #065f46; font-size: 14px; font-weight: 600;">Price Increase:</span>
                  <span style="color: #065f46; font-size: 18px; font-weight: 700;">+${{priceIncrease}} (+{{priceIncrease}}%)</span>
                </div>
              </div>
              <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 30px 0; border-radius: 6px;">
                <p style="margin: 0 0 10px; color: #1e40af; font-size: 14px; font-weight: 600;">Value Increase:</p>
                <p style="margin: 0; color: #1e40af; font-size: 24px; font-weight: 700;">+${{valueIncrease}} USD</p>
              </div>
              <div style="text-align: center; margin: 40px 0 20px;">
                <a href="{{appUrl}}/wallet" style="display: inline-block; padding: 14px 32px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Your Wallet</a>
              </div>
            </td>
          </tr>
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

export function getDefaultOTPTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Verification Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header with Danger Theme -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); border-radius: 12px 12px 0 0;">
              <div style="width: 80px; height: 80px; margin: 0 auto 20px; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px; color: #ffffff;">🔐</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Security Verification</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 30px; border-radius: 6px;">
                <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6; font-weight: 600;">
                  ⚠️ SECURITY ALERT: {{alertTitle}}
                </p>
              </div>
              
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">Verify Your Identity</h2>
              
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                {{actionMessage}}
              </p>
              
              <!-- OTP Code Box -->
              <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border: 3px solid #dc2626; border-radius: 12px; padding: 30px; margin: 30px 0; text-align: center; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2);">
                <p style="margin: 0 0 15px; color: #991b1b; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                  Your Verification Code
                </p>
                <div style="background-color: #ffffff; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; margin: 15px 0;">
                  <p style="margin: 0; color: #dc2626; font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                    {{otpCode}}
                  </p>
                </div>
                <p style="margin: 15px 0 0; color: #991b1b; font-size: 13px; font-weight: 600;">
                  ⏰ This code expires in {{expiresIn}} minutes
                </p>
              </div>
              
              <!-- Warning Section -->
              <div style="background-color: #fff7ed; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h3 style="margin: 0 0 15px; color: #92400e; font-size: 16px; font-weight: 600;">
                  🚨 Important Security Information
                </h3>
                <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 14px; line-height: 1.8;">
                  <li>This code is valid for <strong>{{expiresIn}} minutes</strong> only</li>
                  <li>Do not share this code with anyone</li>
                  <li>If you did not request this code, <strong>DO NOT</strong> use it</li>
                  <li>Contact support immediately if you suspect unauthorized access</li>
                </ul>
              </div>
              
              <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 30px 0; border-radius: 6px;">
                <p style="margin: 0; color: #991b1b; font-size: 13px; line-height: 1.6;">
                  <strong>{{unauthorizedWarning}}</strong><br>
                  This could indicate unauthorized access. Please contact our security team immediately and do not use this verification code.
                </p>
              </div>
              
              <p style="margin: 30px 0 0; color: #9ca3af; font-size: 14px; line-height: 1.6; text-align: center;">
                This is an automated security message from American Coin. Please do not reply to this email.
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
