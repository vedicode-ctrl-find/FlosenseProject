/**
 * repair_atlas_data.js
 * Converts string IDs back to MongoDB ObjectIds in your Atlas cluster.
 * Run: node repair_atlas_data.js
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
require('dns').setServers(['8.8.8.8', '8.8.4.4']);

const URI = process.env.MONGODB_URI;

async function repair() {
    const client = new MongoClient(URI);
    try {
        console.log('🔌 Connecting to Atlas for repair...');
        await client.connect();
        const db = client.db('flowsense');
        console.log('✅ Connected\n');

        const collections = ['companies', 'employees', 'projects', 'tasks', 'notifications', 'messages'];

        for (const colName of collections) {
            console.log(`🛠️  Repairing ${colName}...`);
            const col = db.collection(colName);
            const docs = await col.find({}).toArray();

            for (const doc of docs) {
                const updates = {};
                const originalId = doc._id;

                // 1. Convert _id to ObjectId if it's a string
                if (typeof doc._id === 'string' && ObjectId.isValid(doc._id)) {
                    // We need to delete and re-insert because _id is immutable, 
                    // or just use a new collection. But safer is to update OTHER fields first.
                }

                // 2. Map of fields to convert in each collection
                const fieldsToFix = {
                    'employees': ['company_id'],
                    'projects': ['company_id', 'team_lead'],
                    'tasks': ['company_id', 'projectId', 'assigneeId', 'assignedBy'],
                    'notifications': ['company_id', 'projectId', 'userId'],
                    'messages': ['projectId', 'senderId', 'receiverId', 'taskId']
                };

                const currentFields = fieldsToFix[colName] || [];
                currentFields.forEach(field => {
                    if (doc[field] && typeof doc[field] === 'string' && ObjectId.isValid(doc[field])) {
                        updates[field] = new ObjectId(doc[field]);
                    }
                    // Handle team_members array in projects
                    if (field === 'team_members' && Array.isArray(doc.team_members)) {
                        updates.team_members = doc.team_members.map(id => 
                            (typeof id === 'string' && ObjectId.isValid(id)) ? new ObjectId(id) : id
                        );
                    }
                });

                // Special case for team_members in projects (it's not in the map above)
                if (colName === 'projects' && Array.isArray(doc.team_members)) {
                    updates.team_members = doc.team_members.map(id => 
                        (typeof id === 'string' && ObjectId.isValid(id)) ? new ObjectId(id) : id
                    );
                }

                if (Object.keys(updates).length > 0) {
                    await col.updateOne({ _id: doc._id }, { $set: updates });
                }
            }
            console.log(`  ✅ ${colName} fields updated.`);
        }

        // 3. Final Step: The _id itself needs to be an ObjectId.
        // Since _id is immutable, we must replace the documents.
        for (const colName of collections) {
            console.log(`🆔 Converting _id types in ${colName}...`);
            const col = db.collection(colName);
            const docs = await col.find({}).toArray();

            for (const doc of docs) {
                if (typeof doc._id === 'string' && ObjectId.isValid(doc._id)) {
                    const newDoc = { ...doc, _id: new ObjectId(doc._id) };
                    await col.deleteOne({ _id: doc._id });
                    await col.insertOne(newDoc);
                }
            }
            console.log(`  ✅ ${colName} _ids converted.`);
        }

        console.log('\n🎉 Repair complete! All IDs are now proper ObjectIds.');
        console.log('Login and data fetching should work now.');

    } catch (err) {
        console.error('❌ Repair failed:', err.message);
    } finally {
        await client.close();
    }
}

repair();
