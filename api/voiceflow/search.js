const express = require('express');
const { MongoClient } = require('mongodb');

// Initialize Express app
const app = express();
app.use(express.json());

// Environment variables with fallback constants for development
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://username:password@cluster.mongodb.net/';
const DB_NAME = process.env.DB_NAME || 'your_database_name';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'products';
const SEARCH_INDEX_NAME = process.env.SEARCH_INDEX_NAME || 'default';

// Debug: Log environment variable presence (not values for security)
console.log('Environment check:', {
  hasMongoUri: !!process.env.MONGO_URI,
  hasDbName: !!process.env.DB_NAME,
  hasCollectionName: !!process.env.COLLECTION_NAME,
  dbNameValue: DB_NAME
});

// MongoDB client singleton (connection pooling)
let cachedClient = null;
let cachedDb = null;
let connectionPromise = null;

/**
 * Connect to MongoDB with connection pooling
 * Reuses existing connection if available
 * Handles serverless environment properly
 */
async function connectToDatabase() {
  // Return cached connection if available and still connected
  if (cachedClient && cachedDb) {
    try {
      // Ping to verify connection is still alive
      await cachedClient.db('admin').command({ ping: 1 });
      return { client: cachedClient, db: cachedDb };
    } catch (error) {
      // Connection is dead, reset cache
      console.warn('Cached connection is dead, reconnecting...', error.message);
      cachedClient = null;
      cachedDb = null;
    }
  }

  // If connection is in progress, wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  // Start new connection
  connectionPromise = (async () => {
    try {
      // Validate environment variables
      if (!MONGO_URI || MONGO_URI.includes('username:password') || MONGO_URI.includes('your_')) {
        throw new Error('MONGO_URI is not properly configured. Please set it in environment variables.');
      }
      if (!DB_NAME || DB_NAME === 'your_database_name') {
        throw new Error('DB_NAME is not properly configured. Please set it in environment variables.');
      }

      console.log('Connecting to MongoDB...', { 
        db: DB_NAME, 
        collection: COLLECTION_NAME,
        hasUri: !!MONGO_URI 
      });

      const client = new MongoClient(MONGO_URI, {
        maxPoolSize: 10,
        minPoolSize: 1,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        retryWrites: true,
        retryReads: true,
      });

      // Connect with timeout
      await Promise.race([
        client.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
        )
      ]);

      // Verify connection by pinging
      await client.db('admin').command({ ping: 1 });
      
      const db = client.db(DB_NAME);
      
      // Verify database and collection exist
      const collections = await db.listCollections({ name: COLLECTION_NAME }).toArray();
      if (collections.length === 0) {
        console.warn(`Collection "${COLLECTION_NAME}" not found in database "${DB_NAME}"`);
      }

      console.log('Successfully connected to MongoDB');

      cachedClient = client;
      cachedDb = db;
      connectionPromise = null;

      return { client, db };
    } catch (error) {
      connectionPromise = null;
      console.error('MongoDB connection error:', {
        message: error.message,
        stack: error.stack,
        mongoUri: MONGO_URI ? '***configured***' : 'missing',
        dbName: DB_NAME,
        collectionName: COLLECTION_NAME
      });
      throw new Error(`Failed to connect to MongoDB: ${error.message}`);
    }
  })();

  return connectionPromise;
}

/**
 * Smart search function: All words must appear in the same product
 * Searches across multiple columns: Sous-catégorie 1, 2, 3, Désignation, Description, Marque
 * Returns ALL matching products (no limit)
 */
async function smartSearch(collection, query, brand = null) {
  // Extract keywords from query
  const keywords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  
  if (keywords.length === 0) {
    return [];
  }

  // Build search conditions - all keywords must appear somewhere in the product
  // We'll use $and with $or to ensure all keywords match in the same document
  const searchFields = [
    'Sous-categorie 1',
    'Sous-categorie 2', 
    'Sous-categorie 3',
    'Designation',
    'Description',
    'Marque'
  ];

  // Create conditions: each keyword must appear in at least one of the fields
  const keywordConditions = keywords.map(keyword => ({
    $or: searchFields.map(field => ({
      [field]: { $regex: keyword, $options: 'i' }
    }))
  }));

  // Build match criteria
  const matchCriteria = {
    $and: keywordConditions
  };

  // Add brand filter if provided
  if (brand) {
    matchCriteria['Marque'] = { $regex: brand, $options: 'i' };
  }

  // Execute search - NO LIMIT, return all results
  const results = await collection.find(matchCriteria)
    .toArray();

  return results;
}

/**
 * Group results by different criteria for filtering
 */
function groupResults(results) {
  const groups = {
    brands: {},
    categories: {},
    sous_categories: {},
    materials: {}
  };

  results.forEach(product => {
    // Group by brand
    if (product.Marque) {
      groups.brands[product.Marque] = (groups.brands[product.Marque] || 0) + 1;
    }

    // Group by category
    if (product['Categorie racine']) {
      groups.categories[product['Categorie racine']] = (groups.categories[product['Categorie racine']] || 0) + 1;
    }

    // Group by sous-categorie
    if (product['Sous-categorie 1']) {
      groups.sous_categories[product['Sous-categorie 1']] = (groups.sous_categories[product['Sous-categorie 1']] || 0) + 1;
    }

    // Try to extract material from description
    const description = (product.Description || '').toLowerCase();
    const materials = ['verre', 'plastique', 'métal', 'acier', 'aluminium', 'borosilicate', 'pyrex'];
    materials.forEach(material => {
      if (description.includes(material)) {
        groups.materials[material] = (groups.materials[material] || 0) + 1;
      }
    });
  });

  // Convert to arrays and sort by count
  return {
    brands: Object.entries(groups.brands)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
,
    categories: Object.entries(groups.categories)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    sous_categories: Object.entries(groups.sous_categories)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    materials: Object.entries(groups.materials)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  };
}

/**
 * Extract brand from query if mentioned
 */
function extractBrand(query) {
  const commonBrands = [
    'BELLCO', 'THERMO SCIENTIFIC', 'CORNING', 'MERCK', 'TESTO', 
    'SARTORIUS', 'OXOID', 'DIVERS DUTSCHER', 'SPS MEDICAL', 'HYGIPLUS',
    'BIOTIUM', 'ZEULAB', 'LIOFILCHEM', 'MACHEREY NAGEL', 'BIOTEM'
  ];
  
  const queryUpper = query.toUpperCase();
  for (const brand of commonBrands) {
    if (queryUpper.includes(brand)) {
      return brand;
    }
  }
  return null;
}

/**
 * POST /api/voiceflow/search
 * Smart search endpoint with multi-step filtering support
 */
app.post('/', async (req, res) => {
  try {
    // Validate incoming query from Voiceflow
    const { query, limit } = req.body;

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(200).json({
        speech: 'Je n\'ai pas reçu de requête de recherche. Veuillez me dire ce que vous cherchez.',
        results: []
      });
    }

    // No limit - return all results
    const resultLimit = parseInt(limit) || 999999;

    // Prepare query variations to better support French accents/diacritics
    const trimmedQuery = query.trim();
    const lowerCaseQuery = trimmedQuery.toLowerCase();
    const normalizedQuery = trimmedQuery
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const searchPaths = [
      'Designation',
      'Description',
      'Marque',
      'Categorie racine',
      'Sous-categorie 1',
      'Sous-categorie 2',
      'Reference'
    ];

    const buildTextStage = (queryString, boost) => {
      const textStage = {
        path: searchPaths,
        query: queryString
      };

      if (queryString.length >= 3) {
        textStage.fuzzy = {
          maxEdits: 1,
          prefixLength: 2
        };
      }

      if (boost && boost > 1) {
        textStage.score = { boost: { value: boost } };
      }

      return { text: textStage };
    };

    const phraseTranslations = [
      { pattern: /\bglass\s+tubes?\b/gi, replacement: 'tubes en verre' },
      { pattern: /\bglass\s+tube\b/gi, replacement: 'tube en verre' },
      { pattern: /\bborosilicate\b/gi, replacement: 'borosilicate' },
      { pattern: /\bpyrex\b/gi, replacement: 'pyrex' },
      { pattern: /\bsecurity\s+cameras?\b/gi, replacement: 'caméra de sécurité' },
      { pattern: /\bsurveillance\s+cameras?\b/gi, replacement: 'caméra de surveillance' },
      { pattern: /\bsurveillance\b/gi, replacement: 'surveillance' },
      { pattern: /\bsafety\s+equipment\b/gi, replacement: 'équipement de sécurité' },
      { pattern: /\bsmart\s+lock\b/gi, replacement: 'serrure connectée' },
      { pattern: /\bfire\s+alarm\b/gi, replacement: 'alarme incendie' },
      { pattern: /\bprotective\s+mask\b/gi, replacement: 'masque de protection' },
      { pattern: /\bprotective\s+gloves?\b/gi, replacement: 'gants de protection' }
    ];

    let phraseTranslatedQuery = trimmedQuery;
    for (const { pattern, replacement } of phraseTranslations) {
      phraseTranslatedQuery = phraseTranslatedQuery.replace(pattern, replacement);
    }

    const translationDictionary = {
      security: 'sécurité',
      secure: 'sécurisé',
      safety: 'sécurité',
      protection: 'protection',
      surveillance: 'surveillance',
      camera: 'caméra',
      cameras: 'caméras',
      alarm: 'alarme',
      alarms: 'alarmes',
      lock: 'serrure',
      locks: 'serrures',
      glass: 'verre',
      tube: 'tube',
      tubes: 'tubes',
      mask: 'masque',
      masks: 'masques',
      cleaning: 'nettoyage',
      disinfectant: 'désinfectant',
      disinfectants: 'désinfectants'
    };

    const translatedTokens = phraseTranslatedQuery
      .split(/\s+/)
      .map(token => {
        const lower = token.toLowerCase();
        return translationDictionary[lower] || token;
      });

    const translatedQuery = translatedTokens.join(' ');

    const keywordExpansions = {
      glass: ['verre'],
      tube: ['tube', 'verre'],
      tubes: ['tubes', 'tube', 'verre'],
      borosilicate: ['borosilicate'],
      pyrex: ['pyrex'],
      security: ['sécurité'],
      camera: ['caméra', 'sécurité'],
      cameras: ['caméras', 'sécurité'],
      alarm: ['alarme', 'sécurité'],
      alarms: ['alarmes', 'sécurité'],
      lock: ['serrure'],
      locks: ['serrures'],
      cleaning: ['nettoyage', 'désinfection'],
      disinfectant: ['désinfectant'],
      surveillance: ['surveillance'],
      respirator: ['respiratoire'],
      mask: ['masque'],
      masks: ['masques'],
      glove: ['gant'],
      gloves: ['gants'],
      safety: ['sécurité']
    };

    const expansionTokens = new Set();
    for (const [englishWord, synonyms] of Object.entries(keywordExpansions)) {
      const wordPattern = new RegExp(`\\b${englishWord}\\b`, 'i');
      if (wordPattern.test(lowerCaseQuery)) {
        synonyms.forEach(token => expansionTokens.add(token));
      }
    }

    const queryVariants = new Map();
    queryVariants.set(trimmedQuery, 3);

    if (normalizedQuery !== trimmedQuery) {
      queryVariants.set(normalizedQuery, 2);
    }

    if (translatedQuery !== trimmedQuery) {
      queryVariants.set(translatedQuery, 2);
      const normalizedTranslatedQuery = translatedQuery
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (normalizedTranslatedQuery !== translatedQuery) {
        queryVariants.set(normalizedTranslatedQuery, 1.5);
      }
    }

    if (expansionTokens.size > 0) {
      const appendedKeywords = Array.from(expansionTokens).join(' ');
      const expandedQuery = `${translatedQuery} ${appendedKeywords}`.trim();
      if (!queryVariants.has(expandedQuery)) {
        queryVariants.set(expandedQuery, 1.5);
      }

      const expandedNormalizedQuery = expandedQuery
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      if (!queryVariants.has(expandedNormalizedQuery)) {
        queryVariants.set(expandedNormalizedQuery, 1.25);
      }
    }

    console.log('search query received', {
      trimmedQuery,
      queryVariants: Array.from(queryVariants.keys())
    });

    // Connect to MongoDB
    const { db } = await connectToDatabase();
    const collection = db.collection(COLLECTION_NAME);

    // MongoDB Atlas Search aggregation pipeline - Return ALL fields
    const searchPipeline = [
      {
        $search: {
          index: SEARCH_INDEX_NAME,
          compound: {
            should: Array.from(queryVariants.entries()).map(([variant, boost]) =>
              buildTextStage(variant, boost)
            ),
            minimumShouldMatch: 1
          }
        }
      },
      {
        $addFields: {
          score: { $meta: 'searchScore' }
        }
      },
      {
        $project: {
          _id: 0  // Only exclude MongoDB _id, include everything else
        }
      }
    ];

    // Execute search
    let results;
    try {
      results = await collection.aggregate(searchPipeline).toArray();
    } catch (searchError) {
      console.error('MongoDB search error:', {
        message: searchError.message,
        query: trimmedQuery,
        errorCode: searchError.code
      });
      
      // Check if it's an index error
      if (searchError.message && searchError.message.includes('index')) {
        return res.status(500).json({
          speech: `Erreur de configuration: l'index de recherche "${SEARCH_INDEX_NAME}" n'existe pas ou n'est pas configuré correctement.`,
          results: [],
          error: process.env.NODE_ENV === 'development' ? searchError.message : undefined
        });
      }
      
      throw searchError; // Re-throw to be caught by outer catch
    }

    // Format response for Voiceflow - Return ALL results for AI to process
    const count = results.length;
    
    if (count === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        message: `Aucun produit trouvé pour "${query}"`,
        query: query,
        results: [],
        metadata: {
          search_performed: true,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Return ALL results without filtering - Let Voiceflow AI handle the data
    return res.status(200).json({
      success: true,
      count: count,
      message: `${count} produit${count > 1 ? 's' : ''} trouvé${count > 1 ? 's' : ''}`,
      query: query,
      results: results,  // Return complete documents with ALL fields
      metadata: {
        search_performed: true,
        timestamp: new Date().toISOString(),
        total_results: count
      }
    });

  } catch (error) {
    console.error('Error processing search request:', {
      message: error.message,
      stack: error.stack,
      errorType: error.constructor.name
    });

    // Check for specific error types and provide helpful messages
    let errorMessage = 'Désolé, j\'ai rencontré une erreur lors de la recherche.';
    let diagnosticInfo = null;

    if (error.message && error.message.includes('MONGO_URI')) {
      errorMessage = 'Désolé, je ne peux pas me connecter à la base de données. La configuration de connexion est manquante.';
      diagnosticInfo = 'MONGO_URI environment variable not configured';
    } else if (error.message && error.message.includes('DB_NAME')) {
      errorMessage = 'Désolé, je ne peux pas me connecter à la base de données. Le nom de la base de données n\'est pas configuré.';
      diagnosticInfo = 'DB_NAME environment variable not configured';
    } else if (error.message && error.message.includes('Failed to connect')) {
      errorMessage = 'Désolé, je ne peux pas me connecter à la base de données. Il semble y avoir un problème de connexion temporaire.';
      diagnosticInfo = 'MongoDB connection failed - check network access and credentials';
    } else if (error.message && (error.message.includes('timeout') || error.message.includes('ENOTFOUND'))) {
      errorMessage = 'Désolé, je ne peux pas me connecter à la base de données. Le serveur ne répond pas.';
      diagnosticInfo = 'Connection timeout - check MongoDB Atlas network access settings';
    } else if (error.message && error.message.includes('authentication')) {
      errorMessage = 'Désolé, je ne peux pas me connecter à la base de données. Problème d\'authentification.';
      diagnosticInfo = 'Authentication failed - check username and password in MONGO_URI';
    }

    // Return friendly error message to Voiceflow with diagnostic info in development
    return res.status(500).json({
      speech: errorMessage,
      results: [],
      error: process.env.NODE_ENV === 'development' ? (diagnosticInfo || error?.message) : undefined,
      diagnostic: process.env.NODE_ENV === 'development' ? {
        type: error.constructor.name,
        message: error.message,
        hint: diagnosticInfo
      } : undefined
    });
  }
});

/**
 * Handle search results based on count
 */
function handleSearchResults(results, query, brand, res) {
  const count = results.length;

  // No results
  if (count === 0) {
    return res.status(200).json({
      step: 'no_results',
      speech: `Je n'ai trouvé aucun produit correspondant à "${query}"${brand ? ` de la marque ${brand}` : ''}. Pouvez-vous reformuler votre recherche ou essayer d'autres mots-clés?`,
      results: [],
      suggestions: [
        'Essayez des mots-clés plus généraux',
        'Vérifiez l\'orthographe',
        'Essayez une autre marque',
        'Utilisez des synonymes'
      ]
    });
  }

  // 1-5 results: show directly
  if (count <= 5) {
    const formattedResults = results.map(product => ({
      reference: product.Reference,
      brand: product.Marque,
      designation: product.Designation
    }));

    return res.status(200).json({
      step: 'final',
      speech: `J'ai trouvé ${count} produit${count > 1 ? 's' : ''} correspondant à votre recherche${brand ? ` de la marque ${brand}` : ''}.`,
      results: formattedResults,
      total_count: count
    });
  }

  // More than 5 results: group and ask for filter
  const groups = groupResults(results);

  // Build filter options message
  let filterMessage = `J'ai trouvé ${count} produits. Pour affiner la recherche, choisissez un filtre:\n\n`;
  
  if (groups.brands.length > 0) {
    filterMessage += `**Marques:** ${groups.brands.map(b => `${b.name} (${b.count})`).join(', ')}\n`;
  }
  if (groups.categories.length > 0) {
    filterMessage += `**Catégories:** ${groups.categories.map(c => `${c.name} (${c.count})`).join(', ')}\n`;
  }
  if (groups.sous_categories.length > 0) {
    filterMessage += `**Sous-catégories:** ${groups.sous_categories.map(s => `${s.name} (${s.count})`).join(', ')}\n`;
  }

  return res.status(200).json({
    step: 'needs_filter',
    speech: filterMessage,
    results: [],
    filters: {
      brands: groups.brands,
      categories: groups.categories,
      sous_categories: groups.sous_categories,
      materials: groups.materials
    },
    total_count: count,
    original_query: query,
    brand: brand
  });
}

/**
 * POST /api/voiceflow/smart-search
 * Smart search with multi-step filtering support
 * Implements: query → ask for brand → search → filter if >5 results → show max 5
 */
app.post('/api/voiceflow/smart-search', async (req, res) => {
  try {
    const { query, brand, filter_type, filter_value, step } = req.body;

    // Step 1: Initial query - ask for brand if not provided
    if (step === 'initial' || !step) {
      if (!query || typeof query !== 'string' || query.trim() === '') {
        return res.status(200).json({
          step: 'initial',
          speech: 'Je n\'ai pas reçu de requête de recherche. Veuillez me dire ce que vous cherchez.',
          results: [],
          needs_brand: false
        });
      }

      const extractedBrand = extractBrand(query);
      const queryWithoutBrand = query.replace(new RegExp(extractedBrand || '', 'gi'), '').trim();

      // Search first WITHOUT requiring brand (more flexible)
      // Brand is optional - we'll search with or without it
      let db, collection;
      try {
        const connection = await connectToDatabase();
        db = connection.db;
        collection = db.collection(COLLECTION_NAME);
      } catch (connectionError) {
        console.error('MongoDB connection failed:', {
          message: connectionError.message,
          stack: connectionError.stack,
          errorType: connectionError.constructor.name
        });
        
        // Provide more specific error messages
        let errorMessage = 'Désolé, je ne peux pas me connecter à la base de données. Veuillez réessayer plus tard.';
        let diagnosticInfo = connectionError.message;
        
        if (connectionError.message && connectionError.message.includes('MONGO_URI')) {
          errorMessage = 'Désolé, je ne peux pas me connecter à la base de données. La configuration de connexion est manquante.';
          diagnosticInfo = 'MONGO_URI environment variable not configured in Vercel';
        } else if (connectionError.message && connectionError.message.includes('timeout')) {
          errorMessage = 'Désolé, je ne peux pas me connecter à la base de données. Le serveur ne répond pas.';
          diagnosticInfo = 'Connection timeout - check MongoDB Atlas Network Access allows Vercel IPs (0.0.0.0/0)';
        } else if (connectionError.message && connectionError.message.includes('authentication')) {
          errorMessage = 'Désolé, je ne peux pas me connecter à la base de données. Problème d\'authentification.';
          diagnosticInfo = 'Authentication failed - verify username and password in MONGO_URI';
        }
        
        return res.status(500).json({
          speech: errorMessage,
          results: [],
          error: process.env.NODE_ENV === 'development' ? diagnosticInfo : undefined,
          diagnostic: process.env.NODE_ENV === 'development' ? {
            type: 'ConnectionError',
            message: connectionError.message,
            hint: 'Check Vercel environment variables: MONGO_URI, DB_NAME, COLLECTION_NAME'
          } : undefined
        });
      }

      // Search WITHOUT brand first (more flexible)
      let results = await smartSearch(collection, queryWithoutBrand || query, null, 100);
      
      // If smart search returns no results, try with Atlas Search (more powerful)
      if (results.length === 0) {
        try {
          const searchQuery = translateQuery(queryWithoutBrand || query);
          const searchPaths = ['Designation', 'Description', 'Marque', 'Categorie racine', 'Sous-categorie 1', 'Sous-categorie 2', 'Reference'];
          
          const searchPipeline = [
            {
              $search: {
                index: SEARCH_INDEX_NAME,
                text: {
                  query: searchQuery,
                  path: searchPaths
                }
              }
            }
          ];
          
          results = await collection.aggregate(searchPipeline).toArray();
          console.log(`Atlas Search found ${results.length} results for "${searchQuery}"`);
        } catch (atlasError) {
          console.warn('Atlas Search fallback failed:', atlasError.message);
          // Continue with empty results
        }
      }
      
      // Handle results based on count (will show filters if >5, or results if ≤5)
      return handleSearchResults(results, query, extractedBrand, res);
    }

    // Step 2: Search with brand provided
    if (step === 'search_with_brand') {
      let db, collection;
      try {
        const connection = await connectToDatabase();
        db = connection.db;
        collection = db.collection(COLLECTION_NAME);
      } catch (connectionError) {
        console.error('MongoDB connection failed:', {
          message: connectionError.message,
          stack: connectionError.stack,
          errorType: connectionError.constructor.name
        });
        
        // Provide more specific error messages
        let errorMessage = 'Désolé, je ne peux pas me connecter à la base de données. Veuillez réessayer plus tard.';
        let diagnosticInfo = connectionError.message;
        
        if (connectionError.message && connectionError.message.includes('MONGO_URI')) {
          errorMessage = 'Désolé, je ne peux pas me connecter à la base de données. La configuration de connexion est manquante.';
          diagnosticInfo = 'MONGO_URI environment variable not configured in Vercel';
        } else if (connectionError.message && connectionError.message.includes('timeout')) {
          errorMessage = 'Désolé, je ne peux pas me connecter à la base de données. Le serveur ne répond pas.';
          diagnosticInfo = 'Connection timeout - check MongoDB Atlas Network Access allows Vercel IPs (0.0.0.0/0)';
        } else if (connectionError.message && connectionError.message.includes('authentication')) {
          errorMessage = 'Désolé, je ne peux pas me connecter à la base de données. Problème d\'authentification.';
          diagnosticInfo = 'Authentication failed - verify username and password in MONGO_URI';
        }
        
        return res.status(500).json({
          speech: errorMessage,
          results: [],
          error: process.env.NODE_ENV === 'development' ? diagnosticInfo : undefined,
          diagnostic: process.env.NODE_ENV === 'development' ? {
            type: 'ConnectionError',
            message: connectionError.message,
            hint: 'Check Vercel environment variables: MONGO_URI, DB_NAME, COLLECTION_NAME'
          } : undefined
        });
      }

      let results = await smartSearch(collection, query, brand, 100);
      
      // If no results, try without brand filter
      if (results.length === 0 && brand) {
        results = await smartSearch(collection, query, null, 100);
      }
      
      // If still no results, use Atlas Search as fallback
      if (results.length === 0) {
        try {
          const searchPaths = ['Designation', 'Description', 'Marque', 'Categorie racine', 'Sous-categorie 1', 'Sous-categorie 2', 'Reference'];
          const searchPipeline = [
            {
              $search: {
                index: SEARCH_INDEX_NAME,
                text: {
                  query: translateQuery(query),
                  path: searchPaths
                }
              }
            }
          ];
          
          if (brand) {
            searchPipeline.push({
              $match: { 'Marque': { $regex: brand, $options: 'i' } }
            });
          }
          
          results = await collection.aggregate(searchPipeline).toArray();
        } catch (atlasError) {
          console.warn('Atlas Search fallback failed:', atlasError.message);
        }
      }
      
      return handleSearchResults(results, query, brand, res);
    }

    // Step 3: Apply filter
    if (step === 'apply_filter') {
      let db, collection;
      try {
        const connection = await connectToDatabase();
        db = connection.db;
        collection = db.collection(COLLECTION_NAME);
      } catch (connectionError) {
        console.error('MongoDB connection failed:', {
          message: connectionError.message,
          stack: connectionError.stack,
          errorType: connectionError.constructor.name
        });
        
        // Provide more specific error messages
        let errorMessage = 'Désolé, je ne peux pas me connecter à la base de données. Veuillez réessayer plus tard.';
        let diagnosticInfo = connectionError.message;
        
        if (connectionError.message && connectionError.message.includes('MONGO_URI')) {
          errorMessage = 'Désolé, je ne peux pas me connecter à la base de données. La configuration de connexion est manquante.';
          diagnosticInfo = 'MONGO_URI environment variable not configured in Vercel';
        } else if (connectionError.message && connectionError.message.includes('timeout')) {
          errorMessage = 'Désolé, je ne peux pas me connecter à la base de données. Le serveur ne répond pas.';
          diagnosticInfo = 'Connection timeout - check MongoDB Atlas Network Access allows Vercel IPs (0.0.0.0/0)';
        } else if (connectionError.message && connectionError.message.includes('authentication')) {
          errorMessage = 'Désolé, je ne peux pas me connecter à la base de données. Problème d\'authentification.';
          diagnosticInfo = 'Authentication failed - verify username and password in MONGO_URI';
        }
        
        return res.status(500).json({
          speech: errorMessage,
          results: [],
          error: process.env.NODE_ENV === 'development' ? diagnosticInfo : undefined,
          diagnostic: process.env.NODE_ENV === 'development' ? {
            type: 'ConnectionError',
            message: connectionError.message,
            hint: 'Check Vercel environment variables: MONGO_URI, DB_NAME, COLLECTION_NAME'
          } : undefined
        });
      }
      
      // Re-search with filter
      let results = await smartSearch(collection, query, brand, 100);
      
      // Apply filter
      if (filter_type === 'brand') {
        results = results.filter(p => p.Marque && p.Marque.toLowerCase().includes(filter_value.toLowerCase()));
      } else if (filter_type === 'category') {
        results = results.filter(p => p['Categorie racine'] && p['Categorie racine'].toLowerCase().includes(filter_value.toLowerCase()));
      } else if (filter_type === 'sous_categorie') {
        results = results.filter(p => p['Sous-categorie 1'] && p['Sous-categorie 1'].toLowerCase().includes(filter_value.toLowerCase()));
      }

      return handleSearchResults(results, query, brand, res);
    }

    return res.status(400).json({
      speech: 'Étape non reconnue. Veuillez réessayer.',
      results: []
    });

  } catch (error) {
    console.error('Error in smart search:', error);
    return res.status(500).json({
      speech: 'Désolé, j\'ai rencontré une erreur lors de la recherche. Veuillez réessayer plus tard.',
      results: [],
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Smart search function: All words must appear in the same product
 * Searches across multiple columns: Sous-catégorie 1, 2, 3, Désignation, Description, Marque
 */
/**
 * Translate common English terms to French
 */
function translateQuery(query) {
  const translations = {
    'test tube': 'tube à essai',
    'test tubes': 'tubes à essai',
    'glass tube': 'tube en verre',
    'glass tubes': 'tubes en verre',
    'borosilicate': 'borosilicate',
    'borosilicate glass': 'verre borosilicate',
    'testing tube': 'tube à essai',
    'testing tubes': 'tubes à essai'
  };
  
  const queryLower = query.toLowerCase();
  for (const [english, french] of Object.entries(translations)) {
    if (queryLower.includes(english)) {
      return query.replace(new RegExp(english, 'gi'), french);
    }
  }
  return query;
}

async function smartSearch(collection, query, brand = null) {
  // Translate common terms
  const translatedQuery = translateQuery(query);
  
  // Extract keywords from query
  let keywords = translatedQuery.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  
  if (keywords.length === 0) {
    return [];
  }

  // Build search conditions - try strict first (all keywords), then fallback to any keyword
  const searchFields = [
    'Sous-categorie 1',
    'Sous-categorie 2', 
    'Sous-categorie 3',
    'Designation',
    'Description',
    'Marque',
    'Categorie racine'
  ];

  // Try strict search first: all keywords must appear
  const keywordConditions = keywords.map(keyword => ({
    $or: searchFields.map(field => ({
      [field]: { $regex: keyword, $options: 'i' }
    }))
  }));

  let matchCriteria = {
    $and: keywordConditions
  };

  // Add brand filter if provided
  if (brand) {
    matchCriteria['Marque'] = { $regex: brand, $options: 'i' };
  }

  // Execute strict search - NO LIMIT
  let results = await collection.find(matchCriteria)
    .toArray();

  // If no results with strict search, try relaxed search (any keyword matches)
  if (results.length === 0 && keywords.length > 1) {
    const relaxedConditions = {
      $or: keywords.flatMap(keyword =>
        searchFields.map(field => ({
          [field]: { $regex: keyword, $options: 'i' }
        }))
      )
    };

    if (brand) {
      matchCriteria = {
        $and: [
          relaxedConditions,
          { 'Marque': { $regex: brand, $options: 'i' } }
        ]
      };
    } else {
      matchCriteria = relaxedConditions;
    }

    results = await collection.find(matchCriteria)
      .toArray();
  }

  // If still no results, try single keyword search
  if (results.length === 0 && keywords.length > 0) {
    const mainKeyword = keywords[0]; // Use the most important keyword
    matchCriteria = {
      $or: searchFields.map(field => ({
        [field]: { $regex: mainKeyword, $options: 'i' }
      }))
    };

    if (brand) {
      matchCriteria = {
        $and: [
          matchCriteria,
          { 'Marque': { $regex: brand, $options: 'i' } }
        ]
      };
    }

    results = await collection.find(matchCriteria)
      .toArray();
  }

  return results;
}

/**
 * Group results by different criteria for filtering
 */
function groupResults(results) {
  const groups = {
    brands: {},
    categories: {},
    sous_categories: {},
    materials: {}
  };

  results.forEach(product => {
    // Group by brand
    if (product.Marque) {
      groups.brands[product.Marque] = (groups.brands[product.Marque] || 0) + 1;
    }

    // Group by category
    if (product['Categorie racine']) {
      groups.categories[product['Categorie racine']] = (groups.categories[product['Categorie racine']] || 0) + 1;
    }

    // Group by sous-categorie
    if (product['Sous-categorie 1']) {
      groups.sous_categories[product['Sous-categorie 1']] = (groups.sous_categories[product['Sous-categorie 1']] || 0) + 1;
    }

    // Try to extract material from description
    const description = (product.Description || '').toLowerCase();
    const materials = ['verre', 'plastique', 'métal', 'acier', 'aluminium', 'borosilicate', 'pyrex'];
    materials.forEach(material => {
      if (description.includes(material)) {
        groups.materials[material] = (groups.materials[material] || 0) + 1;
      }
    });
  });

  // Convert to arrays and sort by count
  return {
    brands: Object.entries(groups.brands)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
,
    categories: Object.entries(groups.categories)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    sous_categories: Object.entries(groups.sous_categories)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    materials: Object.entries(groups.materials)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  };
}

/**
 * Extract brand from query if mentioned
 */
function extractBrand(query) {
  const commonBrands = [
    'BELLCO', 'THERMO SCIENTIFIC', 'CORNING', 'MERCK', 'TESTO', 
    'SARTORIUS', 'OXOID', 'DIVERS DUTSCHER', 'SPS MEDICAL', 'HYGIPLUS',
    'BIOTIUM', 'ZEULAB', 'LIOFILCHEM', 'MACHEREY NAGEL', 'BIOTEM'
  ];
  
  const queryUpper = query.toUpperCase();
  for (const brand of commonBrands) {
    if (queryUpper.includes(brand)) {
      return brand;
    }
  }
  return null;
}

/**
 * Handle search results based on count
 */
function handleSearchResults(results, query, brand, res) {
  const count = results.length;

  // No results
  if (count === 0) {
    return res.status(200).json({
      step: 'no_results',
      speech: `Je n'ai trouvé aucun produit correspondant à "${query}"${brand ? ` de la marque ${brand}` : ''}. Pouvez-vous reformuler votre recherche ou essayer d'autres mots-clés?`,
      results: [],
      suggestions: [
        'Essayez des mots-clés plus généraux',
        'Vérifiez l\'orthographe',
        'Essayez une autre marque',
        'Utilisez des synonymes'
      ]
    });
  }

  // 1-5 results: show directly
  if (count <= 5) {
    const formattedResults = results.map(product => ({
      reference: product.Reference,
      brand: product.Marque,
      designation: product.Designation
    }));

    return res.status(200).json({
      step: 'final',
      speech: `J'ai trouvé ${count} produit${count > 1 ? 's' : ''} correspondant à votre recherche${brand ? ` de la marque ${brand}` : ''}.`,
      results: formattedResults,
      total_count: count
    });
  }

  // More than 5 results: group and ask for filter
  const groups = groupResults(results);

  // Build filter options message
  let filterMessage = `J'ai trouvé ${count} produits. Pour affiner la recherche, choisissez un filtre:\n\n`;
  
  if (groups.brands.length > 0) {
    filterMessage += `**Marques:** ${groups.brands.map(b => `${b.name} (${b.count})`).join(', ')}\n`;
  }
  if (groups.categories.length > 0) {
    filterMessage += `**Catégories:** ${groups.categories.map(c => `${c.name} (${c.count})`).join(', ')}\n`;
  }
  if (groups.sous_categories.length > 0) {
    filterMessage += `**Sous-catégories:** ${groups.sous_categories.map(s => `${s.name} (${s.count})`).join(', ')}\n`;
  }

  return res.status(200).json({
    step: 'needs_filter',
    speech: filterMessage,
    results: [],
    filters: {
      brands: groups.brands,
      categories: groups.categories,
      sous_categories: groups.sous_categories,
      materials: groups.materials
    },
    total_count: count,
    original_query: query,
    brand: brand
  });
}

/**
 * POST /api/voiceflow/browse
 * Get all products with category and brand recommendations
 */
app.post('/api/voiceflow/browse', async (req, res) => {
  try {
    const { category, brand, limit } = req.body;
    
    // Connect to MongoDB
    let db, collection;
    try {
      const connection = await connectToDatabase();
      db = connection.db;
      collection = db.collection(COLLECTION_NAME);
    } catch (connectionError) {
      console.error('MongoDB connection failed in browse:', connectionError);
      return res.status(500).json({
        speech: 'Désolé, je ne peux pas me connecter à la base de données. Veuillez réessayer plus tard.',
        total_products: 0,
        categories: [],
        brands: [],
        top_5_recommendations: [],
        all_products: [],
        error: process.env.NODE_ENV === 'development' ? connectionError.message : undefined
      });
    }

    // Build match criteria
    const matchCriteria = {};
    if (category) {
      matchCriteria['Categorie racine'] = category;
    }
    if (brand) {
      matchCriteria['Marque'] = brand;
    }

    // Get products with optional filtering - NO LIMIT
    const resultLimit = parseInt(limit) || 999999;
    
    // Build pipeline - Return ALL fields from database
    const pipeline = [
      ...(Object.keys(matchCriteria).length > 0 ? [{ $match: matchCriteria }] : []),
      {
        $project: {
          _id: 0  // Only exclude MongoDB _id, include everything else
        }
      }
    ];

    let allProducts, categoryStats, brandStats;
    try {
      allProducts = await collection.aggregate(pipeline).toArray();

      // Get category statistics - ALL categories
      categoryStats = await collection.aggregate([
        { $group: { 
            _id: '$Categorie racine', 
            count: { $sum: 1 } 
          } 
        },
        { $sort: { count: -1 } }
      ]).toArray();

      // Get brand statistics - ALL brands
      brandStats = await collection.aggregate([
        { $group: { 
            _id: '$Marque', 
            count: { $sum: 1 } 
          } 
        },
        { $sort: { count: -1 } }
      ]).toArray();
    } catch (queryError) {
      console.error('MongoDB query error in browse:', queryError);
      return res.status(500).json({
        speech: 'Désolé, une erreur s\'est produite lors de la récupération des produits. Veuillez réessayer plus tard.',
        total_products: 0,
        categories: [],
        brands: [],
        top_5_recommendations: [],
        all_products: [],
        error: process.env.NODE_ENV === 'development' ? queryError.message : undefined
      });
    }

    // Return ALL products for AI to process
    const totalCount = allProducts.length;
    let message = '';
    
    if (category && brand) {
      message = `${totalCount} produits ${brand} dans ${category}`;
    } else if (category) {
      message = `${totalCount} produits dans ${category}`;
    } else if (brand) {
      message = `${totalCount} produits de ${brand}`;
    } else {
      message = `${totalCount} produits disponibles`;
    }

    return res.status(200).json({
      success: true,
      message,
      count: totalCount,
      filters: {
        category: category || null,
        brand: brand || null
      },
      available_categories: categoryStats.map(c => ({ name: c._id, count: c.count })),
      available_brands: brandStats.map(b => ({ name: b._id, count: b.count })),
      results: allProducts,  // Return complete documents with ALL fields
      metadata: {
        total_categories: categoryStats.length,
        total_brands: brandStats.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error processing browse request:', error);
    return res.status(500).json({
      speech: 'Désolé, j\'ai rencontré une erreur. Veuillez réessayer plus tard.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/voiceflow/add-product
 * Add a single product to MongoDB
 */
app.post('/api/voiceflow/add-product', async (req, res) => {
  try {
    const product = req.body;

    // Validate required fields
    if (!product.Reference) {
      return res.status(400).json({
        success: false,
        message: 'Reference is required',
        error: 'Missing required field: Reference'
      });
    }

    if (!product.Designation) {
      return res.status(400).json({
        success: false,
        message: 'Designation is required',
        error: 'Missing required field: Designation'
      });
    }

    // Connect to MongoDB
    let db, collection;
    try {
      const connection = await connectToDatabase();
      db = connection.db;
      collection = db.collection(COLLECTION_NAME);
    } catch (connectionError) {
      console.error('MongoDB connection failed:', connectionError);
      return res.status(500).json({
        success: false,
        message: 'Failed to connect to database',
        error: process.env.NODE_ENV === 'development' ? connectionError.message : undefined
      });
    }

    // Check if product with same Reference already exists
    const existing = await collection.findOne({ Reference: product.Reference });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Product with Reference "${product.Reference}" already exists`,
        error: 'Duplicate Reference',
        existing_product: {
          reference: existing.Reference,
          designation: existing.Designation
        }
      });
    }

    // Insert product
    const result = await collection.insertOne(product);

    return res.status(201).json({
      success: true,
      message: 'Product added successfully',
      product_id: result.insertedId,
      reference: product.Reference,
      designation: product.Designation
    });

  } catch (error) {
    console.error('Error adding product:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/voiceflow/add-products
 * Add multiple products to MongoDB (bulk insert)
 */
app.post('/api/voiceflow/add-products', async (req, res) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        message: 'Products array is required',
        error: 'Request body must contain "products" array'
      });
    }

    if (products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Products array is empty',
        error: 'At least one product is required'
      });
    }

    // Validate each product
    const errors = [];
    products.forEach((product, index) => {
      if (!product.Reference) {
        errors.push(`Product ${index + 1}: Missing Reference`);
      }
      if (!product.Designation) {
        errors.push(`Product ${index + 1}: Missing Designation`);
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors
      });
    }

    // Connect to MongoDB
    let db, collection;
    try {
      const connection = await connectToDatabase();
      db = connection.db;
      collection = db.collection(COLLECTION_NAME);
    } catch (connectionError) {
      console.error('MongoDB connection failed:', connectionError);
      return res.status(500).json({
        success: false,
        message: 'Failed to connect to database',
        error: process.env.NODE_ENV === 'development' ? connectionError.message : undefined
      });
    }

    // Insert products (skip duplicates)
    const result = await collection.insertMany(products, { ordered: false });

    return res.status(201).json({
      success: true,
      message: `Successfully added ${result.insertedCount} product(s)`,
      inserted_count: result.insertedCount,
      total_requested: products.length,
      skipped: products.length - result.insertedCount,
      inserted_ids: Object.values(result.insertedIds)
    });

  } catch (error) {
    console.error('Error adding products:', error);
    
    // Handle bulk write errors
    if (error.writeErrors) {
      return res.status(207).json({
        success: true,
        message: 'Some products were added, some failed',
        inserted_count: error.result?.insertedCount || 0,
        errors: error.writeErrors.map(e => ({
          index: e.index,
          code: e.code,
          message: e.errmsg
        }))
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to add products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/voiceflow/update-product
 * Update an existing product by Reference
 */
app.put('/api/voiceflow/update-product', async (req, res) => {
  try {
    const { reference, ...updateData } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Reference is required',
        error: 'Missing required field: reference'
      });
    }

    // Connect to MongoDB
    let db, collection;
    try {
      const connection = await connectToDatabase();
      db = connection.db;
      collection = db.collection(COLLECTION_NAME);
    } catch (connectionError) {
      console.error('MongoDB connection failed:', connectionError);
      return res.status(500).json({
        success: false,
        message: 'Failed to connect to database',
        error: process.env.NODE_ENV === 'development' ? connectionError.message : undefined
      });
    }

    // Update product
    const result = await collection.updateOne(
      { Reference: reference },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Product with Reference "${reference}" not found`,
        error: 'Product not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      reference: reference,
      modified_count: result.modifiedCount
    });

  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/voiceflow/delete-product
 * Delete a product by Reference
 */
app.delete('/api/voiceflow/delete-product', async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Reference is required',
        error: 'Missing required field: reference'
      });
    }

    // Connect to MongoDB
    let db, collection;
    try {
      const connection = await connectToDatabase();
      db = connection.db;
      collection = db.collection(COLLECTION_NAME);
    } catch (connectionError) {
      console.error('MongoDB connection failed:', connectionError);
      return res.status(500).json({
        success: false,
        message: 'Failed to connect to database',
        error: process.env.NODE_ENV === 'development' ? connectionError.message : undefined
      });
    }

    // Delete product
    const result = await collection.deleteOne({ Reference: reference });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Product with Reference "${reference}" not found`,
        error: 'Product not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      reference: reference
    });

  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Health check endpoint with MongoDB connection test
app.get('/', async (req, res) => {
  const health = {
    status: 'ok',
    message: 'Voiceflow-MongoDB Search API is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      search: 'POST /api/voiceflow/search',
      browse: 'POST /api/voiceflow/browse',
      smart_search: 'POST /api/voiceflow/smart-search',
      add_product: 'POST /api/voiceflow/add-product',
      add_products: 'POST /api/voiceflow/add-products',
      update_product: 'PUT /api/voiceflow/update-product',
      delete_product: 'DELETE /api/voiceflow/delete-product'
    },
    mongodb: {
      connected: false,
      database: DB_NAME,
      collection: COLLECTION_NAME,
      searchIndex: SEARCH_INDEX_NAME
    }
  };

  // Test MongoDB connection
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection(COLLECTION_NAME);
    
    // Count total documents in collection
    const count = await collection.countDocuments({});
    
    health.mongodb.connected = true;
    health.mongodb.documentCount = count;
    health.mongodb.status = 'connected';
    
    res.status(200).json(health);
  } catch (error) {
    health.status = 'degraded';
    health.mongodb.connected = false;
    health.mongodb.status = 'disconnected';
    health.mongodb.error = process.env.NODE_ENV === 'development' ? error.message : 'Connection failed';
    
    res.status(503).json(health);
  }
});

// Export the Express app for Vercel
module.exports = app;


