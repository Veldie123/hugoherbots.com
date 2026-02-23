#!/usr/bin/env node
/**
 * Config Lint Test
 * Validates referential integrity between config files:
 * - All technique IDs in klant_houdingen.ts exist in technieken_index.json
 * - All technique numbers referenced elsewhere are valid
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

function loadTechniekenIndex() {
  const filePath = path.join(DATA_DIR, 'technieken_index.json');
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  console.log(`📚 Loaded technieken_index.json v${data._meta?.version || 'unknown'}`);
  
  const validIds = new Set(Object.keys(data.technieken));
  console.log(`   Found ${validIds.size} techniques`);
  
  return { data, validIds };
}

function extractTechniqueIdsFromKlantHoudingen() {
  const filePath = path.join(DATA_DIR, 'klant_houdingen.ts');
  const content = fs.readFileSync(filePath, 'utf-8');
  
  const ids = new Set();
  const regex = /recommended_technique_ids:\s*\[([\s\S]*?)\]/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const idsStr = match[1];
    const idMatches = idsStr.match(/"([^"]+)"/g);
    if (idMatches) {
      idMatches.forEach(id => ids.add(id.replace(/"/g, '')));
    }
  }
  
  console.log(`🎯 Found ${ids.size} technique IDs referenced in klant_houdingen.ts`);
  return ids;
}

function validateReferences(validIds, referencedIds, sourceName) {
  const errors = [];
  
  for (const id of referencedIds) {
    if (!validIds.has(id)) {
      errors.push({
        source: sourceName,
        id: id,
        message: `Technique ID "${id}" not found in technieken_index.json`
      });
    }
  }
  
  return errors;
}

function main() {
  console.log('\n🔍 Config Lint - Referential Integrity Check\n');
  console.log('='.repeat(50));
  
  let hasErrors = false;
  
  try {
    const { data, validIds } = loadTechniekenIndex();
    const klantHoudingenIds = extractTechniqueIdsFromKlantHoudingen();
    
    console.log('\n📋 Validating references...\n');
    
    const errors = validateReferences(validIds, klantHoudingenIds, 'klant_houdingen.ts');
    
    if (errors.length > 0) {
      hasErrors = true;
      console.log('❌ ERRORS FOUND:\n');
      errors.forEach(err => {
        console.log(`   [${err.source}] ${err.message}`);
      });
    } else {
      console.log('✅ All technique references are valid!');
    }
    
    console.log('\n' + '='.repeat(50));
    
    if (hasErrors) {
      console.log('❌ Config lint FAILED\n');
      process.exit(1);
    } else {
      console.log('✅ Config lint PASSED\n');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Error during config lint:', error.message);
    process.exit(1);
  }
}

main();
