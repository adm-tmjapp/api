
const mongoose = require('mongoose');

const uri = "mongodb+srv://tmjdrives:KY26dlHCc5GMAARr@tmjapp-cluster.5ibod.mongodb.net/tmjapp?retryWrites=true&w=majority&appName=tmjapp-cluster";

async function checkData() {
  await mongoose.connect(uri);
  const Ride = mongoose.connection.collection('rides');
  const count = await Ride.countDocuments({});
  console.log('Rides count in tmjapp DB:', count);
  
  const last5 = await Ride.find({}).sort({ _id: -1 }).limit(5).toArray();
  last5.forEach(r => {
    console.log(`ID: ${r._id}, Status: ${r.status}, RequestedAt: ${r.requestedAt}`);
  });
  
  process.exit(0);
}

checkData().catch(err => {
  console.error(err);
  process.exit(1);
});
