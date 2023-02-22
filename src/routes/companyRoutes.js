const router = require("express").Router();

const Headset = require("../models/Headset");
const User = require("../models/User");

const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const ActivityData = require("../models/ActivityData");
const fs = require('fs');
const { Readable } = require("stream");
const readline = require("readline");

const multerConfig = multer()

const configMulter = {
  dest: path.resolve(__dirname, "..", "..", "uploads"),
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.resolve(__dirname, "..", "..", "uploads"));
    },
    filename: (req, file, cb) => {
      crypto.randomBytes(16, (err, hash) => {
        if (err) cb(err);

        file.key = `${hash.toString("hex")}-${file.originalname}`;
        console.info("File inserido ->", file);
        cb(null, file.key);
      });
    }
  }),
  limits: {
    fileSize: 2 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "text/csv",
      "application/xls",
      "application/x-xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    //Esta autoizando todos os arquivos
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo invalido."));
    }
  }
}

router.use((req, res, next) => {
  //console.log("Called: ", req.auth.profile);
  if (req.auth.profile != "SUPERVISOR") {
    return res.status(401).json({ msg: "Não autorizado" });
  }
  next();
});

router.get("/relatorio/:id", async (req, res) => {
  const { date } = req.query;
  const dateTofind = new Date(date);
  const finalDate = new Date(`${date}T23:59:59.000Z`);

  const filtro = {
    company: mongoose.Types.ObjectId(req.auth.company),
    user: mongoose.Types.ObjectId(req.params.id),
    createdAt: {"$gte": dateTofind, "$lte": finalDate}
  }

  const result = await ActivityData.find(filtro).exec();
  const localSeries= [];
  const localCategories= [];
  result.map((item) => {
    if(item.createAt > dateTofind && item.createAt < finalDate){
      localSeries.push(item.status);
      localCategories.push(item.createAt.toLocaleString('pt-BR', {timeZone: 'America/Sao_Paulo'}));
    }
  });

  
  return res.status(200).json({ localSeries, localCategories});
});

router.post(
  "/headset/upload",
  multerConfig.single("file"),
  async (req, res) => {
    const { file } = req;
    const { buffer } = file;

    const readableFile = new Readable();
    readableFile.push(buffer);
    readableFile.push(null);

    const headsetLine = readline.createInterface({
      input: readableFile,
    });

    const headsetCsv = [];

    for await(let line of headsetLine){
      const headsetLineSplit = line.split(",");

     if(headsetLineSplit[2].trim() !== ""){
      headsetCsv.push({
        model: headsetLineSplit[0],
        serial_number: headsetLineSplit[1],
        locale: headsetLineSplit[2],
      });
     }
    }

    const existents = []

    try {
      for (let index = 0; index < headsetCsv.length; index++) {
        let {model, serial_number, locale} = headsetCsv[index];

        const headsetWithSerial = await Headset.findOne({ serial_number });
        if (!headsetWithSerial) {
          await Headset({
            model,
            serial_number,
            locale,
            company: req.auth.company,
          }).save();
        }else{
          existents.push(serial_number);
        }
        
      }

    return res.status(200).json({msg: `Foram importados ${headsetCsv.length - existents.length}`, existents: existents  });
      
    } catch (error) {
      await tryError(error, res);
    }

    return res.status(500).json({msg: "Erro ao Importa arquivo!"})
  }
);

/*
router.post(
  "/headset/upload",
  multer(configMulter).single("file"),
  async (req, res) => {
    const headsetCsv = [];

    try{
      const data = fs.readFileSync(req.file.path, 'utf8');

      for await (let line of data.split('\n')) {
        let headsetLineSplit = line.split(";");
        if(headsetLineSplit.length <= 1){
          headsetLineSplit = line.split(",");
        }
        if(headsetLineSplit[1] && headsetLineSplit[1].trim().length > 0){
          headsetCsv.push({
            model: headsetLineSplit[0],
            serial_number: headsetLineSplit[1],
            locale: headsetLineSplit[2],
          });

        }
      }

    } catch( error){
      console.log(error);
      res.status(500).json({ msg: "Erro ao tentar carregar o arquivo" });
      return;
    }

    const existents = []
    try {
      for await (let { model, serial_number, locale } of headsetCsv) {
        // const headsetWithModel = await Headset.findOne({ model });
        // if (headsetWithModel) {
        //   return res.status(400).json({ msg: "Modelo já cadastrado" });
        // }

        const headsetWithSerial = await Headset.findOne({ serial_number });
        if (headsetWithSerial) {
          existents.push(serial_number);
          // return res
          //   .status(400)
          //   .json({ msg: "Numero de serial já cadastrado" });
        } else {
          await Headset({
            model,
            serial_number,
            locale,
            company: req.auth.company,
          }).save();
        }
      }
      fs.unlinkSync(req.file.path);
      res.status(200).json({ msg: `Foram importados ${headsetCsv.length - existents.length}`, existents: existents });
    } catch (error) {
      await tryError(error, res);
    }
  }
);*/

router.post("/headset", async (req, res) => {
  const { model, serial_number, locale } = req.body;

  if (!model | !serial_number | !locale) {
    return res.status(400).json({ msg: "Campo invalido" });
  }
  try {
    const headset = new Headset({
      model,
      serial_number,
      locale,
      company: req.auth.company,
    });

    await headset.save();
    res.status(200).json(headset);
  } catch (error) {
    await tryError(error, res);
  }
});

router.get("/headset", async (req, res) => {
  const { limit, skip } = req.query;

  return res.status(200).json(
    await Headset.find({
      company: req.auth.company,
    })
      .skip(Number(skip))
      .limit(Number(limit))
  );
});

router.put("/headset/:id", async (req, res) => {
  const _id = req.params.id;
  const { model, serial_number, locale, status } = req.body;

  try {
    let headset = await Headset.findByIdAndUpdate(_id, {
      model,
      serial_number,
      locale,
      status,
    });
    if (!headset) {
      return res.status(404).json({ msg: "Não encontrado" });
    }

    let usuarioComHeadest = await User.findOne({ headset : _id});
    usuarioComHeadest.headset = undefined;
    await usuarioComHeadest.save();

    res.status(200).json({ msg: "Atualizado com sucesso" });
  } catch (error) {
    await tryError(error, res);
  }
});

router.post("/user", async (req, res) => {
  const { name, cpf, registry, email, phone, headset, profile } = req.body;

  if (!name | !cpf | !registry | !email | !phone) {
    return res.status(400).json({ msg: "Campo invalido" });
  }

  if (!profile || ("OPERADOR" != profile && "SUPERVISOR" != profile)) {
    return res.status(400).json({ msg: "Perfil invalido" });
  }

  const userWithRegistry = await User.findOne({ registry });
  if (userWithRegistry) {
    return res.status(400).json({ msg: "Registro já cadastrado" });
  }

  const userWithCpf = await User.findOne({ cpf });
  if (userWithCpf) {
    return res.status(400).json({ msg: "CPF já cadastrado" });
  }

  const userWithEmail = await User.findOne({ email });
  if (userWithEmail) {
    return res.status(400).json({ msg: "E-mail já cadastrado" });
  }

  const existHeadset = await Headset.findOne({ headset });
  if (existHeadset) {
    existHeadset.status = 'EM_USO';
    await existHeadset.save();
  }

  try {
    const passwordUnique = "@unix";
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(passwordUnique, salt);

    const user = new User({
      name,
      cpf,
      registry,
      email,
      phone,
      headset,
      password: passwordHash,
      profile,
      company: req.auth.company,
    });

    await user.save();
    res.status(200).json({msg: 'Usuario criado com sucesso!'});
  } catch (error) {
    await tryError(error, res);
  }
});

router.put("/user/:id", async (req, res) => {
  const _id = req.params.id;
  const { name, cpf, registry, email, phone, enabled, profile, password, headset } =
    req.body;

  let newData = {
    name,
    cpf,
    email,
    phone,
    profile,
    registry,
    enabled,
    headset
  };
  if(password !== undefined){
    const salt = await bcrypt.genSalt(12);
    newData.password = await bcrypt.hash(password, salt);
  }

  try {

    let userFromBase = await User.findById(_id);
    if (!userFromBase) {
      return res.status(404).json({ msg: "Não encontrado" });
    }

    if( headset !== userFromBase.headset && userFromBase.headset !== undefined){
      const existUsedHeadset = await Headset.findById(userFromBase.headset);
      existUsedHeadset.status = 'DISPONIVEL';
      await existUsedHeadset.save();

      const existHeadset = await Headset.findById(headset);
      if (existHeadset) {
        existHeadset.status = 'EM_USO';
        await existHeadset.save();
      }
    } else if(!headset){
      userFromBase.headset = undefined;
      await userFromBase.save();
    }


    await User.findByIdAndUpdate(_id, newData);

    res.status(200).json({ msg: "Atualizado com sucesso" });
  } catch (error) {
    await tryError(error, res);
  }
});

router.get("/user", async (req, res) => {
  const { name, registry, limit, skip } = req.query;

  const company = req.auth.company;
  let list;
  if (name && !name.trim() !== "") {
    list =  await User.find({
        name,
        company,
      })
        .skip(Number(skip))
        .limit(Number(limit));

  } else
  if (registry && !registry.trim() !== "") {
    list =  await User.find({
        registry,
        company,
      })
        .skip(Number(skip))
        .limit(Number(limit));

  } else {
    list = await User.find({
      company,
    })
      .skip(Number(skip))
      .limit(Number(limit));

  }
  try{
    for (let index = 0; index < list.length; index++) {
      if(list[index].headset !== undefined){
        list[index].headset = await Headset.findById(list[index].headset);
      }
      list[index].password = undefined;
      list[index].__v = undefined;
      list[index].company = undefined;
    }

    res.status(200).json(list);
  } catch (error) {
    await tryError(error, res);
  }
});

async function tryError(error, res) {
  if (error.name === "ValidationError") {
    let errors = {};

    Object.keys(error.errors).forEach((key) => {
      errors[key] = error.errors[key].message;
    });

    return res.status(400).send(errors);
  }
  console.log(error);
  res.status(500).json({ msg: "Erro interno no servidor" });
}

module.exports = router;
