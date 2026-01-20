import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
const LOCAL_DB_URI = process.env.LOCAL_DB_URI;
const ATLAS_DB_URI = process.env.ATLAS_DB_URI;

// Connect to local database
const connectLocal = async () => {
    try {
        await mongoose.connect(LOCAL_DB_URI);
        console.log("✅ Connected to LOCAL database");
        return mongoose.connection;
    } catch (error) {
        console.error("❌ Local connection error:", error.message);
        process.exit(1);
    }
};

// Connect to Atlas database
const connectAtlas = async () => {
    try {
        const atlasConnection = mongoose.createConnection(ATLAS_DB_URI);
        await atlasConnection.asPromise();
        console.log("✅ Connected to ATLAS database");
        return atlasConnection;
    } catch (error) {
        console.error("❌ Atlas connection error:", error.message);
        process.exit(1);
    }
};

// Migrate collection
const migrateCollection = async (localConnection, atlasConnection, collectionName) => {
    try {
        const localCollection = localConnection.db.collection(collectionName);
        const atlasCollection = atlasConnection.db.collection(collectionName);

        // Count documents in local
        const localCount = await localCollection.countDocuments();
        console.log(`\n📦 ${collectionName}: Found ${localCount} documents in local database`);

        if (localCount === 0) {
            console.log(`⏭️  Skipping ${collectionName} (empty collection)`);
            return;
        }

        // Fetch all documents from local
        const documents = await localCollection.find({}).toArray();
        console.log(`📥 Fetched ${documents.length} documents from local`);

        // Insert into Atlas
        if (documents.length > 0) {
            // Option 1: Insert all at once (faster, but might fail if duplicates)
            try {
                const result = await atlasCollection.insertMany(documents, {
                    ordered: false, // Continue even if some fail (handles duplicates)
                });
                console.log(
                    `✅ Successfully migrated ${result.insertedCount} documents to Atlas`
                );
            } catch (error) {
                if (error.code === 11000) {
                    // Duplicate key error - try inserting one by one
                    console.log(
                        `⚠️  Some documents already exist. Migrating remaining documents...`
                    );
                    let successCount = 0;
                    let skippedCount = 0;

                    for (const doc of documents) {
                        try {
                            await atlasCollection.insertOne(doc);
                            successCount++;
                        } catch (err) {
                            if (err.code === 11000) {
                                skippedCount++;
                            } else {
                                console.error(`❌ Error inserting document:`, err.message);
                            }
                        }
                    }
                    console.log(
                        `✅ Migrated ${successCount} new documents (${skippedCount} already existed)`
                    );
                } else {
                    throw error;
                }
            }
        }
    } catch (error) {
        console.error(`❌ Error migrating ${collectionName}:`, error.message);
    }
};

// Main migration function
const migrate = async () => {
    console.log("🚀 Starting database migration from LOCAL to ATLAS\n");

    const localConnection = await connectLocal();
    const atlasConnection = await connectAtlas();

    // List of collections to migrate
    // TODO: Add more collections to migrate here
    const collections = ["users","sessions"];

    console.log("\n📋 Collections to migrate:", collections.join(", "));

    // Migrate each collection
    for (const collectionName of collections) {
        await migrateCollection(localConnection, atlasConnection, collectionName);
    }

    console.log("\n✅ Migration completed!");
    console.log("\n📊 Verifying migration...");

    // Verify by counting documents in Atlas
    for (const collectionName of collections) {
        try {
            const atlasCollection = atlasConnection.db.collection(collectionName);
            const count = await atlasCollection.countDocuments();
            console.log(`   ${collectionName}: ${count} documents`);
        } catch (error) {
            console.log(`   ${collectionName}: Collection doesn't exist yet`);
        }
    }

    // Close connections
    await localConnection.close();
    await atlasConnection.close();

    console.log("\n🎉 All done! Check your MongoDB Atlas database.");
    process.exit(0);
};

// Run migration
migrate().catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
});

