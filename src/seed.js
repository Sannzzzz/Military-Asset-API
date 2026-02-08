require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./db/connection');
const { User, Base, Asset, Personnel } = require('./models');

const seedDatabase = async () => {
    try {
        await connectDB();
        console.log('Connected to MongoDB Atlas');

        // Clear existing data
        console.log('Clearing existing data...');
        await User.deleteMany({});
        await Base.deleteMany({});
        await Asset.deleteMany({});
        await Personnel.deleteMany({});

        // Create bases
        console.log('Creating bases...');
        const alphaBase = await Base.create({ name: 'Alpha Base', location: 'Northern Region' });
        const bravoBase = await Base.create({ name: 'Bravo Base', location: 'Southern Region' });
        const charlieBase = await Base.create({ name: 'Charlie Base', location: 'Eastern Region' });

        // Create users with different roles
        console.log('Creating users...');

        // ADMIN
        const admin = await User.create({
            username: 'admin',
            password: 'admin123',
            fullName: 'System Administrator',
            role: 'ADMIN',
            base: null
        });

        // BASE_COMMANDER
        const commander1 = await User.create({
            username: 'commander1',
            password: 'commander123',
            fullName: 'Alpha Base Commander',
            role: 'BASE_COMMANDER',
            base: alphaBase._id
        });

        const commander2 = await User.create({
            username: 'commander2',
            password: 'commander123',
            fullName: 'Bravo Base Commander',
            role: 'BASE_COMMANDER',
            base: bravoBase._id
        });

        // LOGISTICS_OFFICER
        const logistics1 = await User.create({
            username: 'logistics1',
            password: 'logistics123',
            fullName: 'Alpha Logistics Officer',
            role: 'LOGISTICS_OFFICER',
            base: alphaBase._id
        });

        const logistics2 = await User.create({
            username: 'logistics2',
            password: 'logistics123',
            fullName: 'Bravo Logistics Officer',
            role: 'LOGISTICS_OFFICER',
            base: bravoBase._id
        });

        // PERSONNEL
        const johnSmith = await User.create({
            username: 'john.smith',
            password: 'personnel123',
            fullName: 'John Smith',
            role: 'PERSONNEL',
            base: alphaBase._id
        });

        const janeDoe = await User.create({
            username: 'jane.doe',
            password: 'personnel123',
            fullName: 'Jane Doe',
            role: 'PERSONNEL',
            base: alphaBase._id
        });

        const bobWilson = await User.create({
            username: 'bob.wilson',
            password: 'personnel123',
            fullName: 'Bob Wilson',
            role: 'PERSONNEL',
            base: bravoBase._id
        });

        // Create personnel records
        console.log('Creating personnel records...');
        await Personnel.create({ name: 'John Smith', rank: 'Sergeant', user: johnSmith._id, base: alphaBase._id });
        await Personnel.create({ name: 'Jane Doe', rank: 'Corporal', user: janeDoe._id, base: alphaBase._id });
        await Personnel.create({ name: 'Bob Wilson', rank: 'Private', user: bobWilson._id, base: bravoBase._id });

        // Create assets
        console.log('Creating assets...');
        await Asset.create({ name: 'Humvee', equipmentType: 'VEHICLE', quantity: 10, condition: 'GOOD', base: alphaBase._id });
        await Asset.create({ name: 'M16 Rifle', equipmentType: 'WEAPON', quantity: 50, condition: 'GOOD', base: alphaBase._id });
        await Asset.create({ name: '5.56mm Rounds', equipmentType: 'AMMUNITION', quantity: 10000, condition: 'GOOD', base: alphaBase._id });
        await Asset.create({ name: 'Tank M1', equipmentType: 'VEHICLE', quantity: 5, condition: 'GOOD', base: bravoBase._id });
        await Asset.create({ name: 'AK-47', equipmentType: 'WEAPON', quantity: 30, condition: 'FAIR', base: bravoBase._id });
        await Asset.create({ name: '9mm Rounds', equipmentType: 'AMMUNITION', quantity: 5000, condition: 'GOOD', base: charlieBase._id });

        console.log('\n✅ Database seeded successfully!');
        console.log('\n=== Demo Users ===');
        console.log('ADMIN:             admin / admin123');
        console.log('BASE_COMMANDER:    commander1 / commander123 (Alpha Base)');
        console.log('BASE_COMMANDER:    commander2 / commander123 (Bravo Base)');
        console.log('LOGISTICS_OFFICER: logistics1 / logistics123 (Alpha Base)');
        console.log('LOGISTICS_OFFICER: logistics2 / logistics123 (Bravo Base)');
        console.log('PERSONNEL:         john.smith / personnel123 (Alpha Base)');
        console.log('PERSONNEL:         jane.doe / personnel123 (Alpha Base)');
        console.log('PERSONNEL:         bob.wilson / personnel123 (Bravo Base)');

        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
};

seedDatabase();
