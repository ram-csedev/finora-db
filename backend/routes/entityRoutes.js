const express = require('express');
const router = express.Router();
const entityService = require('../services/entityService');

// Map convenience plural routes to singular entity names
const ALIAS_MAP = {
  branches: 'branch',
  employees: 'employee',
  customers: 'customer',
  accounts: 'account',
  nominees: 'nominee',
  creditcards: 'creditcard',
  loans: 'loan',
  'loan-payments': 'loan_payment',
  beneficiaries: 'beneficiary',
  transactions: 'transaction',
  'audit-logs': 'audit_log',
  'responsible-for': 'responsible_for'
};

/**
 * Handle listing records
 */
async function handleList(entityName, req, res, next) {
  try {
    const { page, limit, search, sortBy, sortOrder, ...filters } = req.query;
    const result = await entityService.listEntities(entityName, {
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      filters
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle single record retrieval
 */
async function handleGetById(entityName, req, res, next) {
  try {
    const record = await entityService.getEntityById(entityName, req.params.id);
    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle create record
 */
async function handleCreate(entityName, req, res, next) {
  try {
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const created = await entityService.createEntity(entityName, req.body, { ipAddress });
    res.status(201).json({ success: true, message: `${entityName} created successfully.`, data: created });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle update record
 */
async function handleUpdate(entityName, req, res, next) {
  try {
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const updated = await entityService.updateEntity(entityName, req.params.id, req.body, { ipAddress });
    res.json({ success: true, message: `${entityName} updated successfully.`, data: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle delete record
 */
async function handleDelete(entityName, req, res, next) {
  try {
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const result = await entityService.deleteEntity(entityName, req.params.id, { ipAddress });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------------------
// Universal /api/entities/:entity routes
// ----------------------------------------------------------------------------
router.get('/entities/:entity', (req, res, next) => handleList(req.params.entity, req, res, next));
router.get('/entities/:entity/:id', (req, res, next) => handleGetById(req.params.entity, req, res, next));
router.post('/entities/:entity', (req, res, next) => handleCreate(req.params.entity, req, res, next));
router.put('/entities/:entity/:id', (req, res, next) => handleUpdate(req.params.entity, req, res, next));
router.delete('/entities/:entity/:id', (req, res, next) => handleDelete(req.params.entity, req, res, next));

// ----------------------------------------------------------------------------
// Plural convenience aliases (/api/customers, /api/accounts, etc.)
// ----------------------------------------------------------------------------
for (const [plural, singular] of Object.entries(ALIAS_MAP)) {
  router.get(`/${plural}`, (req, res, next) => handleList(singular, req, res, next));
  router.get(`/${plural}/:id`, (req, res, next) => handleGetById(singular, req, res, next));
  router.post(`/${plural}`, (req, res, next) => handleCreate(singular, req, res, next));
  router.put(`/${plural}/:id`, (req, res, next) => handleUpdate(singular, req, res, next));
  router.delete(`/${plural}/:id`, (req, res, next) => handleDelete(singular, req, res, next));
}

module.exports = router;
