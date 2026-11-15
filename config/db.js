const mongoose = require('mongoose');
module.exports = async uri => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log('MongoDB connected');
};
