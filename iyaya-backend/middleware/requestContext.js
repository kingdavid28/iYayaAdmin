// middleware/requestContext.js
module.exports = (req, res, next) => {
  req.ip = req.ip || req.connection.remoteAddress;
  next();
};