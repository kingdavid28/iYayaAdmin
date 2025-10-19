module.exports = {
  regEx: {
    password: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/,
    objectId: /^[0-9a-fA-F]{24}$/,
  },
};