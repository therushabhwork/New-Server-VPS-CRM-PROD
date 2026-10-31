const path = require('path')
const fs = require('fs')
const dotenv = require('dotenv')

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') })

const mongoose = require('mongoose')
const { getMongoModel } = require('../models/mongoModels')

const isExecute = process.argv.includes('--execute')
const isAll = process.argv.includes('--all')
const isOnlyImported = process.argv.includes('--only-imported') || !isAll

async function main() {
  console.log('='.repeat(70))
  console.log(' CRM QUOTATIONS CLEANUP SCRIPT')
  console.log('='.repeat(70))
  console.log(`Execution Mode : ${isExecute ? '*** LIVE EXECUTION (DELETION ENABLED) ***' : '[DRY RUN] Simulation Only (No data will be deleted)'}`)
  console.log(`Target Scope   : ${isAll ? 'ALL Quotations in collection' : 'ONLY Imported Old Quotations (isOldQuotation: true)'}`)
  console.log('-'.repeat(70))

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm'
  console.log(`Connecting to MongoDB at: ${mongoUri}`)

  try {
    await mongoose.connect(mongoUri)
    console.log('MongoDB connected successfully.\n')

    const Quotation = getMongoModel('quotations')

    // 1. Overall inspection
    const totalCount = await Quotation.countDocuments({})
    const importedFilter = {
      $or: [
        { isOldQuotation: true },
        { isExcelImport: true },
        { 'data.isOldQuotation': true },
        { 'data.isExcelImport': true },
      ],
    }
    const importedCount = await Quotation.countDocuments(importedFilter)
    const regularCount = totalCount - importedCount

    console.log(`CURRENT DATABASE STATUS:`)
    console.log(`  • Total Quotations in MongoDB : ${totalCount}`)
    console.log(`  • Imported Old Quotations     : ${importedCount}`)
    console.log(`  • Live CRM Generated Quotes   : ${regularCount}\n`)

    // 2. Determine target filter
    const targetFilter = isAll ? {} : importedFilter
    const targetDocs = await Quotation.find(targetFilter).lean()
    const targetCount = targetDocs.length

    console.log(`TARGETED FOR CLEANUP: ${targetCount} quotations`)

    if (targetCount === 0) {
      console.log('No matching quotation records found to clean.')
      await mongoose.disconnect()
      process.exit(0)
    }

    // 3. Print sample preview of targeted records
    console.log('\nSAMPLE PREVIEW OF TARGETED QUOTATIONS (Up to 10 records):')
    const sample = targetDocs.slice(0, 10).map((q, idx) => ({
      '#': idx + 1,
      'Quote No': q.quotationNumber || q.quoteNumber || '-',
      'Old Quote No': q.oldQuotationNumber || q.data?.oldQuotationNumber || '-',
      'Company': q.companyName || q.customerName || '-',
      'Amount': q.totalAmount || q.amount || 0,
      'Imported': q.isOldQuotation ? 'YES' : 'NO',
      'Created': String(q.createdAt || '').slice(0, 10),
    }))
    console.table(sample)

    // 4. Execution or Dry Run
    if (!isExecute) {
      console.log('\n' + '='.repeat(70))
      console.log('DRY RUN COMPLETE — 0 records were deleted.')
      console.log('To perform real deletion, run one of the following commands:')
      console.log('')
      console.log('  1) To delete ONLY imported old quotations:')
      console.log('     node server/scripts/clean_quotations.js --only-imported --execute')
      console.log('')
      console.log('  2) To delete ALL quotations in the collection:')
      console.log('     node server/scripts/clean_quotations.js --all --execute')
      console.log('='.repeat(70))
      await mongoose.disconnect()
      process.exit(0)
    }

    // 5. Automatic Backup before deletion
    const backupDir = path.join(__dirname, 'backups')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }
    const backupFile = path.join(backupDir, `quotations_backup_${Date.now()}.json`)
    fs.writeFileSync(backupFile, JSON.stringify(targetDocs, null, 2), 'utf8')
    console.log(`\n[BACKUP] Saved safety backup of ${targetCount} quotations to:`)
    console.log(`  ${backupFile}\n`)

    // 6. Perform deletion
    console.log('Deleting targeted quotations from MongoDB...')
    const result = await Quotation.deleteMany(targetFilter)
    console.log(`DELETION SUCCESSFUL: Removed ${result.deletedCount || 0} quotations.`)

    const remainingCount = await Quotation.countDocuments({})
    console.log(`Remaining quotations in MongoDB: ${remainingCount}`)

    await mongoose.disconnect()
    console.log('\nMongoDB disconnected successfully.')
    process.exit(0)
  } catch (err) {
    console.error('\nERROR during quotation cleanup:', err.message || err)
    try {
      await mongoose.disconnect()
    } catch (_) {}
    process.exit(1)
  }
}

main()

