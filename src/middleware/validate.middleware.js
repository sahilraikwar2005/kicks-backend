export const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });

  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.details.map((detail) => detail.message),
    });
  }

  req.body = value;
  return next();
};

export const validateQuery = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.query, { abortEarly: false, stripUnknown: true });

  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.details.map((detail) => detail.message),
    });
  }

  req.query = value;
  return next();
};

export const validateObjectIdParam = (paramName) => (req, res, next) => {
  const value = req.params?.[paramName];
  if (typeof value !== 'string' || !/^[0-9a-fA-F]{24}$/.test(value)) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: [`Invalid ${paramName}: must be a 24-character hex ObjectId`],
    });
  }
  return next();
};
