const mongoose = require('mongoose');

const User = mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }
});

mongoose.model('user', User);