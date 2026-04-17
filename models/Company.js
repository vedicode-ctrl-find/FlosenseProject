const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const CompanySchema = new mongoose.Schema({
    company_name: {
        type: String,
        required: [true, 'Please add a company name'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false
    },
    industry: {
        type: String,
        enum: ['Technology', 'Finance', 'Healthcare', 'Education', 'Manufacturing', 'Retail', 'Other'],
        default: 'Technology'
    },
    company_code: {
        type: String,
        unique: true
    },
    profile_image: {
        type: String,
        default: ''
    },
    billing: {
        plan: {
            type: String,
            enum: ['Free', 'Professional', 'Enterprise'],
            default: 'Free'
        },
        status: {
            type: String,
            enum: ['Active', 'Canceled', 'Past Due'],
            default: 'Active'
        },
        next_billing_date: {
            type: Date,
            default: () => new Date(+new Date() + 30*24*60*60*1000) // Default to 30 days from now
        },
        payment_methods: [{
            card_type: String,
            last4: String,
            expiry: String,
            is_primary: { type: Boolean, default: false }
        }],
        billing_history: [{
            date: { type: Date, default: Date.now },
            amount: Number,
            invoice_id: String,
            plan_name: String
        }]
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

// Auto-generate Company Code and Hash Password before Saving
CompanySchema.pre('save', async function(next) {
    if (!this.isModified('password') && this.company_code) {
        return next();
    }

    // Hash password if modified
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }

    // Generate Company Code if not exists
    if (!this.company_code) {
        // Format: COMP + 4 random digits
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        this.company_code = `COMP${randomDigits}`;
    }

    next();
});

// Match user entered password to hashed password in database
CompanySchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Company', CompanySchema);
