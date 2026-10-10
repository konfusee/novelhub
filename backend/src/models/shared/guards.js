// Field-locking guards that hold on every Mongoose write path: document saves,
// query updates (updateOne/updateMany/findOneAndUpdate), replace operations and
// bulkWrite. Writes through `Model.collection` bypass Mongoose and are forbidden
// for guarded collections.

const UPDATE_QUERIES = ['updateOne', 'updateMany', 'findOneAndUpdate'];
const REPLACE_QUERIES = ['replaceOne', 'findOneAndReplace'];

function updatedPaths(update) {
  if (!update) return [];
  // Aggregation-pipeline updates can rewrite anything; treat them as touching every field.
  if (Array.isArray(update)) return ['*'];
  const paths = [];
  for (const [key, value] of Object.entries(update)) {
    if (!key.startsWith('$')) paths.push(key);
    else if (value && typeof value === 'object') {
      paths.push(...Object.keys(value));
      // $rename writes to its destination paths too.
      if (key === '$rename') paths.push(...Object.values(value));
    }
  }
  return paths;
}

const overlaps = (path, field) =>
  path === '*' || path === field || path.startsWith(`${field}.`) || field.startsWith(`${path}.`);

const isNullish = (value) => value === null || value === undefined;

/**
 * Locks `fields` according to `mode`:
 * - `insert-only`: set when the document is created, never changed afterwards.
 * - `set-once`: may be written while still empty, never changed once set. Query
 *   updates must include `{ <field>: null }` in their filter to set it.
 * - `frozen-by`: writable until `lockField` is set, then frozen. Query updates
 *   must include `{ <lockField>: null }` in their filter. `lockField` itself is
 *   set-once.
 */
export function lockFields(schema, fields, { mode, lockField } = {}) {
  if (!['insert-only', 'set-once', 'frozen-by'].includes(mode)) {
    throw new Error(`lockFields: unknown mode ${mode}`);
  }
  if (mode === 'frozen-by') {
    if (!lockField) throw new Error('lockFields: frozen-by requires lockField');
    lockFields(schema, [lockField], { mode: 'set-once' });
  }

  const describe = (model) => `${model.modelName}: ${fields.join(', ')}`;

  const allowedByFilter = (filter, field) =>
    (mode === 'set-once' && filter?.[field] === null) ||
    (mode === 'frozen-by' && filter?.[lockField] === null);

  function assertUpdateAllowed(model, filter, update) {
    const touched = updatedPaths(update);
    for (const field of fields) {
      if (touched.some((p) => overlaps(p, field)) && !allowedByFilter(filter, field)) {
        throw new Error(`${describe(model)} cannot be changed (${mode})`);
      }
    }
  }

  schema.pre(UPDATE_QUERIES, function guardQueryUpdate() {
    assertUpdateAllowed(this.model, this.getFilter(), this.getUpdate());
  });

  schema.pre(REPLACE_QUERIES, function guardReplace() {
    throw new Error(`${describe(this.model)} are locked; replace operations are not allowed`);
  });

  schema.pre('bulkWrite', function guardBulkWrite(ops) {
    for (const op of ops) {
      const [type, body] = Object.entries(op)[0];
      if (type === 'replaceOne') {
        throw new Error(`${describe(this)} are locked; replace operations are not allowed`);
      }
      if (type === 'updateOne' || type === 'updateMany') {
        assertUpdateAllowed(this, body.filter, body.update);
      }
    }
  });

  schema.pre('validate', async function guardDocumentSave() {
    if (this.isNew) return;
    const changed = fields.filter((field) => this.isModified(field));
    if (changed.length === 0) return;

    if (mode === 'insert-only') {
      for (const field of changed)
        this.invalidate(field, `${field} cannot be changed after creation`);
      return;
    }

    // Compare with the stored document, inside the caller's transaction if any.
    const probe = mode === 'set-once' ? changed : [lockField];
    const stored = await this.constructor
      .findById(this._id)
      .select(probe.map((f) => `+${f}`).join(' '))
      .session(this.$session())
      .lean();
    if (!stored) {
      for (const field of changed)
        this.invalidate(field, `${field} cannot be verified: document not found`);
      return;
    }
    for (const field of changed) {
      const locked =
        mode === 'set-once' ? !isNullish(stored[field]) : !isNullish(stored[lockField]);
      if (locked)
        this.invalidate(
          field,
          `${field} cannot be changed once ${mode === 'set-once' ? 'set' : `${lockField} is set`}`,
        );
    }
  });
}

/**
 * Restricts `field` to the forward transitions in `transitions`
 * (`{ from: [to, ...] }`). Document saves are checked against the stored value
 * (inside the caller's transaction). Query and bulk updates must use
 * compare-and-set: the filter names the current value (`{ status: 'claimed' }`)
 * and `$set` names an allowed next value. Replace operations are rejected.
 */
export function forwardOnly(schema, field, transitions) {
  const allowed = (from, to) => from === to || (transitions[from] ?? []).includes(to);

  function assertUpdateAllowed(model, filter, update) {
    const touched = updatedPaths(update);
    if (!touched.some((p) => overlaps(p, field))) return;
    const from = filter?.[field];
    const to = update?.$set?.[field];
    if (typeof from !== 'string' || typeof to !== 'string' || !allowed(from, to)) {
      throw new Error(
        `${model.modelName}: ${field} must move forward with compare-and-set ` +
          `(filter on current ${field}, $set an allowed next ${field})`,
      );
    }
  }

  schema.pre(UPDATE_QUERIES, function guardQueryTransition() {
    assertUpdateAllowed(this.model, this.getFilter(), this.getUpdate());
  });

  schema.pre(REPLACE_QUERIES, function guardReplace() {
    throw new Error(
      `${this.model.modelName}: replace operations are not allowed (${field} is forward-only)`,
    );
  });

  schema.pre('bulkWrite', function guardBulkTransition(ops) {
    for (const op of ops) {
      const [type, body] = Object.entries(op)[0];
      if (type === 'replaceOne') {
        throw new Error(
          `${this.modelName}: replace operations are not allowed (${field} is forward-only)`,
        );
      }
      if (type === 'updateOne' || type === 'updateMany')
        assertUpdateAllowed(this, body.filter, body.update);
    }
  });

  schema.pre('validate', async function guardDocumentTransition() {
    if (this.isNew || !this.isModified(field)) return;
    const stored = await this.constructor
      .findById(this._id)
      .select(field)
      .session(this.$session())
      .lean();
    const from = stored?.[field];
    if (!stored || !allowed(from, this.get(field))) {
      this.invalidate(field, `${field} cannot move from ${from} to ${this.get(field)}`);
    }
  });
}
