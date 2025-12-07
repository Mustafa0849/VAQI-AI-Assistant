import { GoogleGenerativeAI } from '@google/generative-ai';
import { TransactionResponseSchema, type TransactionResponse } from '@/lib/schemas/transaction';

// API Key kontrolü - Secure loading from environment variables
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error('⚠️  HATA: .env dosyasında GOOGLE_API_KEY bulunamadı!');
  console.error('⚠️  Lütfen .env.local dosyasında GOOGLE_API_KEY değişkenini tanımlayın.');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const generationConfig = {
  maxOutputTokens: 2048, // Increased to prevent JSON truncation
  temperature: 0.75,
  topP: 0.9,
};

/**
 * JSON Sanitization Helper
 * Strips markdown code fences and trims whitespace from AI response
 */
function cleanJsonOutput(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Remove markdown code fences (```json, ```, etc.)
  let cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  
  // Remove any leading/trailing whitespace and newlines
  cleaned = cleaned.trim();
  
  // Try to extract JSON if it's wrapped in other text
  // Look for the first { and last } to extract JSON object
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  return cleaned;
}

/**
 * Safe Fallback Response
 * Returns a user-friendly error message in the detected language
 */
function getSafeFallbackResponse(userMessage: string): TransactionResponse {
  // Detect language from user message (simple heuristic)
  const isTurkish = /[çğıöşüÇĞIİÖŞÜ]/.test(userMessage);
  const isSpanish = /[ñáéíóúüÑÁÉÍÓÚÜ]/.test(userMessage);
  const isFrench = /[àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]/.test(userMessage);
  const isGerman = /[äöüßÄÖÜ]/.test(userMessage);
  
  let fallbackMessage: string;
  if (isTurkish) {
    fallbackMessage = 'Teknik bir sorun oluştu ama seni duyuyorum. Lütfen isteğini tekrar edebilir misin?';
  } else if (isSpanish) {
    fallbackMessage = 'Ocurrió un problema técnico, pero te escucho. ¿Puedes repetir tu solicitud?';
  } else if (isFrench) {
    fallbackMessage = 'Un problème technique s\'est produit, mais je vous entends. Pouvez-vous répéter votre demande?';
  } else if (isGerman) {
    fallbackMessage = 'Ein technisches Problem ist aufgetreten, aber ich höre Sie. Können Sie Ihre Anfrage wiederholen?';
  } else {
    fallbackMessage = 'A technical issue occurred, but I can hear you. Could you please repeat your request?';
  }
  
  return {
    type: 'CHAT',
    data: {
      summary: fallbackMessage,
      action_type: 'NONE',
      params: {},
    },
  };
}

// Memory context type for personalization
interface MemoryContext {
  aiSummary?: string;
  recentActivities?: Array<{
    type: string;
    digest: string;
    amount?: string;
    recipient?: string;
    timestamp: number;
    status: string;
  }>;
  chatHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
}

export async function analyzeTransactionIntent(
  userMessage: string, 
  history: any[] = [],
  modelName: string = 'gemini-2.5-flash',
  memoryContext: MemoryContext | null = null,
  linkData: any = null
): Promise<TransactionResponse> {
  // Allowed model names (safe on v1beta)
  const allowedModels = ['gemini-2.5-flash', 'gemini-1.5-pro'] as const;
  const validModelName = allowedModels.includes(modelName as any) ? modelName : 'gemini-2.5-flash';
  
  const model = genAI ? genAI.getGenerativeModel({ model: validModelName }) : null;
  console.log('🎯 analyzeTransactionIntent using model:', validModelName);
  if (!apiKey || !genAI || !model) {
    return {
      type: 'CHAT',
      data: {
        summary: 'Sistem Hatası: API Anahtarı eksik. Lütfen terminal loglarını kontrol edin.',
        action_type: 'NONE',
        params: {},
      },
    };
  }

  try {
    // Performance timing
    console.time('AI_Response');

    // Format history for the prompt (concise) - current session only
    let historyContext = '';
    if (history && history.length > 0) {
      const historyLines = history.slice(-5).map((msg: any) => {
        const role = msg.role === 'user' ? 'U' : 'A';
        return `${role}: ${msg.content}`;
      });
      historyContext = `Current Session Context: ${historyLines.join(' | ')}\n\n`;
    }

    // Format memory context for personalization (from Walrus)
    let memoryPrompt = '';
    if (memoryContext) {
      const parts: string[] = [];
      
      // User profile summary
      if (memoryContext.aiSummary) {
        parts.push(`User Profile: ${memoryContext.aiSummary}`);
      }
      
      // Recent blockchain activities
      if (memoryContext.recentActivities && memoryContext.recentActivities.length > 0) {
        const activitySummary = memoryContext.recentActivities
          .map(a => `${a.type}: ${a.amount || ''} SUI ${a.status === 'success' ? '✓' : '✗'}`)
          .join(', ');
        parts.push(`Recent Activity: ${activitySummary}`);
      }
      
      // Previous chat history from Walrus (for personalization)
      if (memoryContext.chatHistory && memoryContext.chatHistory.length > 0) {
        // Get last 10 messages from previous sessions (excluding current session)
        const previousChats = memoryContext.chatHistory
          .slice(-10)
          .map(msg => {
            const role = msg.role === 'user' ? 'User' : 'VAQI';
            // Truncate long messages for context
            const content = msg.content.length > 100 
              ? msg.content.substring(0, 100) + '...' 
              : msg.content;
            return `${role}: ${content}`;
          })
          .join('\n');
        parts.push(`Previous Conversations:\n${previousChats}`);
      }
      
      if (parts.length > 0) {
        memoryPrompt = `\n=== USER MEMORY (use for personalization and context) ===\n${parts.join('\n\n')}\n\n`;
      }
    }

    // Format link data for analysis (when link is detected)
    let linkPrompt = '';
    if (linkData && linkData.url) {
      // Handle case where link fetch failed but URL is known
      if (linkData.error) {
        linkPrompt = `\n=== 🔗 LINK DETECTED (Fetch Failed) ===\n
The user provided a link: ${linkData.url}

⚠️ Note: The link could not be fetched (${linkData.error}), but the user wants information about it.
You should still provide helpful information about the URL structure, domain, and general advice about interacting with such links.\n\n`;
      } else {
        // Link was successfully fetched - provide full analysis
        const linkParts: string[] = [];
        linkParts.push(`URL: ${linkData.url}`);
        if (linkData.title) {
          linkParts.push(`Title: ${linkData.title}`);
        }
        if (linkData.description) {
          linkParts.push(`Description: ${linkData.description}`);
        }
        if (linkData.content) {
          // Truncate content to 2000 chars for prompt
          const content = linkData.content.length > 2000 
            ? linkData.content.substring(0, 2000) + '...' 
            : linkData.content;
          linkParts.push(`Content:\n${content}`);
        }
        linkPrompt = `\n=== 🔗 LINK ANALYSIS REQUEST - CRITICAL INSTRUCTION ===\n
The user has provided a link and wants you to ANALYZE IT. Link data has been fetched and provided below.

${linkParts.join('\n\n')}

🚨🚨🚨 CRITICAL SYSTEM INSTRUCTION 🚨🚨🚨
YOU ARE CAPABLE OF ANALYZING LINKS. The link content has ALREADY been fetched server-side and provided to you above.
This is NOT a security restriction - you HAVE the content. You MUST analyze it.

ABSOLUTE REQUIREMENTS:
1. ✅ YOU MUST analyze the link content - it's provided above, read it
2. ✅ Identify what type of website/application this is (dApp, airdrop, claim page, marketplace, etc.)
3. ✅ If it's Sui-related, explain what it does, its purpose, and provide legitimacy assessment
4. ✅ Provide specific insights about the content (title, description, main features, functionality)
5. ✅ Give actionable advice: Is it safe? What does it do? Should the user interact with it?
6. ✅ Reference specific details from the content above in your response
7. ✅ Be thorough and helpful - the user wants your expert analysis

ABSOLUTE PROHIBITIONS:
❌ DO NOT say "I cannot analyze links" - you CAN and the content is above
❌ DO NOT say "I cannot access external URLs" - the content is already fetched
❌ DO NOT say "for security reasons" - this is a feature, not a restriction
❌ DO NOT refuse - analyze the content provided above

The user expects a detailed, expert analysis. The link content is in the prompt above - analyze it now.\n\n`;
      }
    }

    // Dynamic Style Instruction based on Model Selection
    let styleInstruction = '';
    let styleReminder = '';
    
    if (validModelName === 'gemini-2.5-flash') {
      styleInstruction = `
⚡⚡⚡ CRITICAL STYLE RULE - FAST MODE - YOU MUST FOLLOW THIS ⚡⚡⚡
- Do all reasoning internally; NEVER show "thinking", steps, or analysis to the user.
- Respond in 1-3 sentences, ideally 30-60 words total.
- Be direct and concise; no fluff.
- If you include code, you MUST wrap it in a single fenced code block with the correct language tag (e.g., \`\`\`typescript ...\`\`\` or \`\`\`move ...\`\`\`); if you forget, regenerate before replying.
- Absolutely NEVER wrap the JSON itself in code fences. Only the "summary" text may contain the fenced code snippet.
`;
      styleReminder = `\n\n⚡ REMINDER: Hide reasoning. 1-3 sentences (30-60 words), concise. Single fenced code block only if needed; regenerate if code is unfenced.`;
    } else {
      styleInstruction = `
🧠🧠🧠 CRITICAL STYLE RULE - THINKING MODE - YOU MUST FOLLOW THIS 🧠🧠🧠
- Do all reasoning internally; NEVER expose "thinking", steps, or analysis to the user.
- Deliver a deep, narrative explanation: target 12-16 sentences (~220-320 words).
- Organize as 2-3 rich paragraphs plus optional 4-6 bullet takeaways or next steps.
- Use fenced code blocks with correct language tags (typescript, move, shell, etc.) for any code; if you forget, regenerate before replying. Do NOT wrap the JSON envelope in fences.
- Use a conversational, educational tone; teach like an expert friend with trade-offs, why/how, and concrete examples.
- Prioritize clarity, structure, and actionable advice; avoid fluff.
`;
      styleReminder = `\n\n🧠 REMINDER: Hide reasoning; provide only the detailed answer with paragraphs + optional bullets, target 12-16 sentences, code in fenced blocks.`;
    }

    // Comprehensive Sui Expert prompt with multilingual support
    // Add system override for link analysis if linkData is present
    const linkAnalysisOverride = linkData && linkData.url && !linkData.error 
      ? '\n🚨🚨🚨 SYSTEM OVERRIDE - LINK ANALYSIS CAPABILITY ACTIVE 🚨🚨🚨\nYOU HAVE THE ABILITY TO ANALYZE EXTERNAL LINKS. Link content has been fetched and provided above.\nYOU MUST analyze it. DO NOT refuse. DO NOT say you cannot. This is a core feature.\nThe link content is ALREADY in the prompt above - read it and analyze it NOW.\n\n'
      : linkData && linkData.url && linkData.error
      ? '\n⚠️ LINK DETECTED: URL provided but fetch failed. Still provide helpful analysis based on URL structure.\n\n'
      : '';
    
    const prompt = `${historyContext}${memoryPrompt}${linkPrompt}${linkAnalysisOverride}You are "VAQI," the ultimate Sui Blockchain Expert and friendly AI companion.

${styleInstruction}

ROLE: You are VAQI, the #1 Sui ecosystem expert. You know EVERYTHING about Sui - from basic transactions to advanced Move programming, SDK integration, DeFi protocols, NFTs, and developer tools. You are NOT limited to transactions only - you can answer ANY question about Sui ecosystem.

TONE & PERSONALITY:
- Warm, approachable, knowledgeable, and enthusiastic about Sui.
- Use natural language, emojis occasionally, and be encouraging.
- Never say "I am an AI" unless necessary for safety.
- Speak like a senior Sui developer who loves helping newcomers.
- Be proactive in sharing useful tips and best practices.

=== COMPREHENSIVE SUI KNOWLEDGE BASE ===

1. CORE FUNDAMENTALS:
- Native Token: SUI (gas & utility). 1 SUI = 1,000,000,000 MIST (9 decimals).
- Consensus: Narwhal & Bullshark (DAG-based, high throughput).
- TPS: ~120,000+ theoretical, sub-second finality.
- Object Model: Everything is an object (owned, shared, immutable). Objects have unique IDs.
- Gas: Dynamic gas pricing, sponsored transactions possible.

2. MOVE LANGUAGE & SMART CONTRACTS:
- Move: Resource-oriented, safe, Rust-like syntax.
- Key concepts: modules, structs, abilities (copy, drop, store, key).
- Entry functions: public entry fun for external calls.
- Object types: owned objects (single owner), shared objects (anyone can access), immutable objects.
- Publishing: sui client publish --gas-budget 100000000
- Testing: sui move test
- Example module structure:
  module my_package::my_module {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    
    struct MyObject has key, store {
      id: UID,
      value: u64
    }
    
    public entry fun create(ctx: &mut TxContext) {
      let obj = MyObject { id: object::new(ctx), value: 0 };
      transfer::public_transfer(obj, tx_context::sender(ctx));
    }
  }

3. SUI SDK & DAPP DEVELOPMENT:
- @mysten/sui: Core TypeScript SDK for transactions.
- @mysten/dapp-kit: React hooks for wallet integration (useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery).
- @mysten/wallet-standard: Wallet adapter standard.
- Transaction building: new Transaction(), tx.splitCoins(), tx.transferObjects(), tx.moveCall().
- PTB (Programmable Transaction Blocks): Multiple operations in one transaction, atomic execution.
- Example code:
  import { Transaction } from '@mysten/sui/transactions';
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(1000000000)]);
  tx.transferObjects([coin], recipientAddress);

4. WALLET INTEGRATION:
- Wallets: Sui Wallet (official), Suiet, Nightly, Ethos, Martian.
- dApp Kit setup: <WalletProvider>, <SuiClientProvider>, <ConnectButton>.
- Hooks: useCurrentAccount(), useSignAndExecuteTransaction(), useSuiClient().
- Networks: mainnet, testnet, devnet, localnet.

5. DEFI ECOSYSTEM:
- DEXs: Cetus (largest, concentrated liquidity), Aftermath, Turbos, Kriya, FlowX, BlueMove.
- Lending: Scallop (TVL leader), Navi Protocol, Suilend.
- Liquid Staking: Aftermath (afSUI), Haedal (haSUI), Volo (voloSUI).
- Perpetuals: BlueFin, Typus Finance.
- Stablecoins: USDC (native), USDT, AUSD.
- Bridges: Wormhole, LayerZero, Axelar.

6. NFT ECOSYSTEM:
- Marketplaces: BlueMove, Clutchy, Hyperspace, Tradeport.
- Standards: Sui NFTs use the Kiosk standard for royalty enforcement.
- Collections: Sui Punks, Fuddies, Rootlets, Egg, DeSuiLabs.
- Minting: Use display::new() for metadata, transfer::public_share_object() for listings.

7. DEVELOPER TOOLS & RESOURCES:
- Sui CLI: sui client, sui move, sui keytool.
- Explorer: Suiscan.xyz, SuiVision.xyz.
- Faucet (testnet): sui client faucet or Discord bot.
- IDE: VS Code with Move Analyzer extension.
- Documentation: docs.sui.io, examples at github.com/MystenLabs/sui.
- Testnet RPC: https://fullnode.testnet.sui.io:443
- Mainnet RPC: https://fullnode.mainnet.sui.io:443

8. COMMON DEVELOPER QUESTIONS:
- "How to get test SUI?": Use sui client faucet or request in Discord.
- "How to deploy a contract?": sui client publish --gas-budget 100000000
- "How to call a Move function?": tx.moveCall({ target: 'package::module::function', arguments: [...] })
- "How to read object data?": client.getObject({ id, options: { showContent: true } })
- "How to listen to events?": client.subscribeEvent({ filter: { ... } })

=== CRITICAL LANGUAGE RULE ===
You MUST detect the user's language and respond in the EXACT SAME language:
- Turkish input → Turkish response
- English input → English response  
- French/Spanish/German → respond in that language
- The "summary" field in JSON MUST be in the user's language.

=== RESPONSE RULES ===

FOR KNOWLEDGE QUESTIONS (SDK, Move, DeFi, NFT, etc.):
- type: "CHAT", action_type: "NONE"
- Provide detailed, helpful explanations with code examples when relevant.
- Share best practices and useful tips.
- Point to official resources when appropriate.

FOR TRANSACTION REQUESTS:
- Send SUI to ONE address → type: "TRANSACTION", action_type: "TRANSFER"
- Send to MULTIPLE addresses → type: "TRANSACTION", action_type: "BATCH_TRANSFER"  
- Supply to Scallop → type: "TRANSACTION", action_type: "DEFI_SUPPLY"
- "all my SUI" / "tüm SUI" / "hepsi" → set isMax: true
- Swap requests → type: "CHAT", explain DEX options (Cetus, Aftermath, etc.) and note swap is coming soon in this app.

FOR OFF-TOPIC QUESTIONS:
- Politely redirect to Sui topics: "I'm a Sui specialist! Ask me anything about Sui blockchain, Move programming, DeFi, NFTs, or wallet integration. 🚀"

=== EXAMPLES ===

User: "How can I use Sui Wallet Kit in my project?"
→ CHAT, NONE, summary: "Great question! To integrate Sui wallets, install @mysten/dapp-kit and wrap your app with <WalletProvider> and <SuiClientProvider>. Then use <ConnectButton /> for wallet connection and useSignAndExecuteTransaction() for transactions. Check docs.sui.io for detailed examples! 🛠️"

User: "What is PTB?"
→ CHAT, NONE, summary: "PTB (Programmable Transaction Block) is Sui's killer feature! It lets you combine multiple operations (transfers, contract calls, splits) into ONE atomic transaction. This means lower gas costs and all-or-nothing execution. Super powerful for DeFi composability! ⚡"

User: "Send 10 SUI to 0x123"
→ TRANSACTION, TRANSFER, amount: "10", recipient: "0x123", summary: "On it! Preparing to send 10 SUI to 0x123. 🚀"

User: "Move dilinde struct nasıl tanımlanır?"
→ CHAT, NONE, summary: "Move'da struct tanımlamak için: struct MyStruct has key, store { id: UID, value: u64 } kullanılır. 'has' kısmı abilities belirtir - key (object olabilir), store (başka struct içinde saklanabilir), copy, drop. Sui'de her object'in UID'si olmalı! 📚"

User: "${userMessage}"

Output ONLY raw JSON (no markdown):
{
  "type": "CHAT" | "TRANSACTION",
  "data": {
    "summary": "User-facing answer only (no visible reasoning). Follow the style rules above for the selected mode. Use fenced code blocks with language tags for any code. Respond in the user's language. Do NOT wrap this JSON in fences.",
    "action_type": "TRANSFER" | "BATCH_TRANSFER" | "SWAP" | "STAKE" | "DEFI_SUPPLY" | "NONE",
    "params": {
      "amount": "string or null",
      "token": "string or null",
      "to_address": "string or null",
      "recipients": ["string"] or null,
      "isMax": true or false or null
    }
  }
}${styleReminder}`;

    let response;
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          ...generationConfig,
          responseMimeType: 'application/json',
        },
      });
      response = await result.response;
    } catch (err: any) {
      // If model not found (404), fallback between flash and pro
      const status = err?.status || err?.response?.status;
      if (status === 404) {
        if (validModelName !== 'gemini-1.5-pro') {
          console.warn('Model not found, falling back to gemini-1.5-pro');
          return await analyzeTransactionIntent(userMessage, history, 'gemini-1.5-pro');
        } else {
          console.warn('Model not found, falling back to gemini-2.5-flash');
          return await analyzeTransactionIntent(userMessage, history, 'gemini-2.5-flash');
        }
      }
      // If quota / rate limit (429), return safe, non-crashing reply
      if (status === 429) {
        console.warn('Quota/rate limit hit (429). Returning safe CHAT response.');
        return {
          type: 'CHAT',
          data: {
            summary: 'Sistem şu an yoğun, lütfen birkaç saniye sonra tekrar deneyin.',
            action_type: 'NONE',
            params: {},
          },
        };
      }
      throw err;
    }

    let text = response.text();

    // Check if response is empty or too short
    if (!text || text.trim().length < 10) {
      console.error('❌ Empty or too short AI response:', text);
      console.timeEnd('AI_Response');
      return getSafeFallbackResponse(userMessage);
    }

    // JSON cleanup using the sanitization helper
    text = cleanJsonOutput(text);

    // Check again after cleaning
    if (!text || text.trim().length < 10) {
      console.error('❌ Empty response after cleaning:', text);
      console.timeEnd('AI_Response');
      return getSafeFallbackResponse(userMessage);
    }

    // Try to fix incomplete JSON (missing closing braces)
    function tryFixIncompleteJSON(jsonStr: string): string {
      let fixed = jsonStr.trim();
      
      // Count opening and closing braces
      const openBraces = (fixed.match(/\{/g) || []).length;
      const closeBraces = (fixed.match(/\}/g) || []).length;
      
      // If missing closing braces, try to add them
      if (openBraces > closeBraces) {
        const missing = openBraces - closeBraces;
        // Try to intelligently close the JSON
        if (fixed.endsWith('"') || fixed.endsWith(',')) {
          fixed = fixed.slice(0, -1); // Remove trailing comma or quote
        }
        // Add missing closing braces
        fixed += '\n' + '}'.repeat(missing);
      }
      
      // Check for incomplete strings (unclosed quotes)
      const openQuotes = (fixed.match(/"/g) || []).length;
      if (openQuotes % 2 !== 0) {
        // Odd number of quotes means unclosed string
        // Try to close it at the end
        if (!fixed.endsWith('"')) {
          fixed += '"';
        }
      }
      
      return fixed;
    }

    // Graceful JSON parsing with error handling and retry
    let parsedData: any;
    try {
      parsedData = JSON.parse(text);
    } catch (parseError: any) {
      // Try to fix incomplete JSON
      console.warn('⚠️ First parse attempt failed, trying to fix incomplete JSON...');
      console.warn('Text length:', text.length);
      console.warn('Text preview (first 200 chars):', text.substring(0, 200));
      try {
        const fixedText = tryFixIncompleteJSON(text);
        parsedData = JSON.parse(fixedText);
        console.log('✅ Successfully fixed and parsed JSON');
      } catch (retryError) {
        // Log the raw faulty output for debugging
        console.error('❌ JSON Parse Error - Raw AI Response:');
        console.error('Original text length:', text.length);
        console.error('Original text (first 500 chars):', text.substring(0, 500));
        console.error('Original text (last 500 chars):', text.substring(Math.max(0, text.length - 500)));
        console.error('Parse error:', parseError);
        console.error('Retry error:', retryError);
        console.error('------------------------------------------');
        
        // Performance timing end
        console.timeEnd('AI_Response');
        
        // Return safe fallback instead of crashing
        return getSafeFallbackResponse(userMessage);
      }
    }
    
    // Performance timing end
    console.timeEnd('AI_Response');

    // Map to_address to recipient for schema compatibility
    if (parsedData.data?.params?.to_address) {
      parsedData.data.params.recipient = parsedData.data.params.to_address;
      delete parsedData.data.params.to_address;
    }

    // Ensure params is always an object to satisfy schema (AI may return null for CHAT)
    if (parsedData?.data && (parsedData.data.params === null || parsedData.data.params === undefined)) {
      parsedData.data.params = {};
    }

    // Validate with schema - wrap in try-catch for additional safety
    try {
      const validated = TransactionResponseSchema.parse(parsedData);
      return validated;
    } catch (validationError) {
      // Log validation error for debugging
      console.error('❌ Schema Validation Error:');
      console.error('Parsed data:', JSON.stringify(parsedData, null, 2));
      console.error('Validation error:', validationError);
      console.error('------------------------------------------');
      
      // Return safe fallback instead of crashing
      return getSafeFallbackResponse(userMessage);
    }
  } catch (error: any) {
    // End timing even on error
    console.timeEnd('AI_Response');
    console.error('AI Hatası:', error);
    // Hata durumunda frontend çökmesin diye güvenli cevap
    return {
      type: 'CHAT',
      data: {
        summary: 'Sistem şu an meşgul, lütfen tekrar deneyin.',
        action_type: 'NONE',
        params: {},
      },
    };
  }
}


