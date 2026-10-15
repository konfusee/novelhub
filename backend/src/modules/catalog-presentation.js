import mongoose from 'mongoose';

// Optional editorial presentation data, kept separately from the unchanged domain
// schemas. This collection cannot change story ownership, publication or balances.
export function catalogPresentation() {
  return mongoose.connection.db.collection('catalogPresentation');
}
