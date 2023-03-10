const User = require("../models/User");
const bcrypt = require("bcrypt");
const {getToken} = require("../../config/jwt-config");

const userRegister = async (userDets, profile, res) => {
  let usernameNotTaken = await userExists(userDets.registry);
  if (!usernameNotTaken) {
    return res.status(422).json({
      message: `Por favor, utlize outro registro!`,
      success: false,
    });
  }

  let userWithEmail = await User.exists({ email : userDets.email });
  if (userWithEmail) {
    return res.status(422).json({
      message: `Email ja cadastrado!`,
      success: false,
    });
  }

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(userDets.password, salt);

  const user = new User({
    ...userDets,
    password: passwordHash,
    profile,
  });

  try {
    await user.save();

    res.status(201).json({ meg: "Usuario criado como sucesso" });
  } catch (error) {
    console.log(JSON.stringify(error))
    if (error.name === "ValidationError") {
      let errors = {};

      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });

      return res.status(400).send(errors);
    }
    res.status(500).json({ msg: "Unable to connect with Database" });
  }
};

const login = async (userCreds, res) => {
  const { registry, password } = userCreds;

  const user = await User.findOne({ registry: registry });
  
  if(!user){
    return res.status(401).json({ msg: "Usuario inexistente" });
  }
  const checkPassword = await bcrypt.compare(password, user.password);
  if (!checkPassword) {
    return res.status(422).json({ msg: "Senha invalida!" });
  }
  try {
  
    const obj = {
      id: user._id,
      profile: user.profile,
      company: user.company
    };
  
    const token = getToken(obj);

    const result = {
      name: user.name,
      profile: user.profile,
      token,
      id: user._id,
      enabled: user.enabled
    };

    res
      .status(200)
      .json({ ...result, msg: "Autenticação realizada com sucesso", token });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "error no servidor" });
  }
};

const userExists = async (registry) => {
  const user = await User.exists({ registry });
  return user ? false : true;
};

module.exports = {
  userRegister,
  login
};
