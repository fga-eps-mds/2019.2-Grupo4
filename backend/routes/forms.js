const express = require('express')
const router = express.Router()

require('../models/Users')
require('../models/Formulario')
const convertercsv = require('../../backend/controllers/csv')
const mongoose = require('mongoose')
const modelUsers = mongoose.model("users")
const modelFormulario = mongoose.model("formulario")
const { check, validationResult } = require('express-validator');

//Rota de listagem de formulários
router.get('/', (req, res) => {
    if (req.user) {
        modelUsers.findById(req.user).populate('formulario').then((user) => {
            res.render('./formularios/inicio', { formulario: user.formulario });
        });
    }
    else {
        res.redirect('/users/login');
    }
});

//Rota de cadastro de um novo formulario
router.get('/registro', (req, res) => {
    if (req.user) {
        res.render('./formularios/cadastro_formulario');
    }
    else {
        res.redirect('/users/login');
    }
});

//Rota para salvar novo formulário
router.post('/registro/salvar',[
        //Validação dos campos
        check('name_quest').not().isEmpty().withMessage('Campo nome está vazio.'),
        check('copy_markdown').not().isEmpty().withMessage('Campo markdown está vazio.'),
    ],(req, res) => {
    let dados = req.body;
    let erros = validationResult(req);

    if (erros.array().length > 0) {
        console.log(erros.array());
        res.send({ msg: erros.array().map((erro)=> erro.msg), status: false });
    }
    else {
        var formulario = {
            nome: dados.name_quest,
            data_quest: dados
        };
        new modelFormulario(formulario).save().then((formulario) => {
            let tmpfm = req.user.formulario
            tmpfm.push(formulario)
            modelUsers.updateOne({ _id: req.user.id }, { $set: { 'formulario': tmpfm } }, (err, result) => {
                console.log(result)
                res.send({ msg: 'Questionário cadastrado!', status: true });
                console.log("Salvo com sucesso.");
            })
        }).catch((err) => {
            console.log(err)
            res.send({ msg: ['Falha ao salvar o questionário.'], status: false });
        });
    }
});

//Rota de visualizar um questionário e responder
router.get('/postar/:id', (req, res) => {
    modelFormulario.findOne({ _id: req.params.id }).then((formulario) => {
        console.log(formulario);
        res.render("./formularios/visualizar_formulario", {
            name_quest: formulario.nome,
            copy_html: formulario.data_quest.copy_html,
            map_fields: formulario.data_quest.type_inputs,
            id: formulario._id
        });
    });
});

//Rota para Editar Formulário
router.get('/editar/:id', (req, res) => {
    if (req.user) {
        modelFormulario.findOne({ _id: req.params.id }).then((formulario) => {
            res.render("./formularios/editar_formulario", {
                name_quest: formulario.nome,
                copy_markdown: formulario.data_quest.copy_markdown,
                id: formulario.id
            });
        });
    }
    else {
        res.redirect('/users/login');
    }
});

//Rota para salvar edições dos questionários.
router.post('/salvar_edicao/:id',
    [//Validação dos campos
        check('name_quest').not().isEmpty().withMessage('Campo nome está vazio.'),
        check('copy_markdown').not().isEmpty().withMessage('Campo markdown está vazio.'),
    ], (req, res) => {
        const id = req.params.id;
        let dadosForm = req.body;
        let erros = validationResult(req);

        if (erros.array().length > 0) {
            console.log(erros.array());
            res.send({ msg: erros.array().map((erro)=> erro.msg), status: false });
        }
        else {
            modelFormulario.updateOne({ _id: id }, { $set: { 'nome': dadosForm.name_quest, "data_quest": dadosForm } }, (err, result) => {
                if (err) {
                    console.log('Erro ao salvar a resposta: ' + err);
                    res.send({ msg: 'Falha no servidor ao tentar salvar as modificações.', status: false });
                }
                else {
                    res.send({ msg: 'Modificações salvas com sucesso!', status: true });
                }
            });
        }
    }
);

//Rota de salvar a resposta do questionário
router.post('/salvar_resposta/:id', (req, res) => {
    let resposta = req.body;
    let tmpAnswers = [];
    let id = req.params.id;
    let feedbackMsg;

    console.log(resposta);

    modelFormulario.findOne({ _id: id }, (err, formulario) => {
        if (err) {
            console.log(`Falha ao tentar recuperar respostas anteriores de ${id}.Erro: ` + err);
        }
        else {
            if (formulario.respostas != undefined) tmpAnswers = formulario.respostas;
            tmpAnswers.push(resposta);
            modelFormulario.updateOne({ _id: id }, { $set: { 'respostas': tmpAnswers } }, (err, result) => {
                if (err)
                    feedbackMsg = `Erro ao salvar a resposta.`;
                else
                    feedbackMsg = `Resposta registrada com sucesso !`;
  
                res.render('./formularios/feedback_resposta',{
                                                                id: id,
                                                                msg: feedbackMsg,
                                                                name_quest: formulario.nome
                                                            });
            });
        }
    });

});

//Rota de listagem de resposta de um formulário
router.get('/listar_respostas/:id', (req, res) => {
    if (req.user) {
        modelFormulario.findOne({ _id: req.params.id }).then((formulario) => {
            res.render("./formularios/listar_respostas", { formulario: formulario })
        })
    }
    else {
        res.redirect('/users/login');
    }
});

//Rota de conversão de respostas para csv
router.get('/converter_respostas/:id', (req, res) => {
    console.log(req.body)
    if (req.user) {
        var id = req.params.id
        console.log(req.body)
        modelFormulario.findById(id).then((formulario) => {
            var csv = convertercsv(formulario.respostas)
            var nome = formulario.nome
            res.attachment(nome + '.csv');
            console.log(csv)
            console.log(req.body)
            res.send(Buffer.from(csv));
        })
    }
    else {
        res.redirect('/users/login');
    }
});

//Rota de remoção de um formulário
router.get('/delete/:id', (req, res) => {
    if (req.user) {
        let id = req.params.id;
        modelFormulario.findByIdAndRemove(id).then(() => {
            console.log('deletado');
            res.redirect('/forms')
        }).catch((err) => {
            console.log(err)
            res.redirect('/forms')
        });
    }
    else {
        res.redirect('/users/login');
    }
});

//Rota de acesso ao dashboard das respostas do formulário
router.get('/dashboard/:id', async (req, res) => {
    try {
        if (req.user) {
            const form = await modelFormulario.findOne({ _id: req.params.id });
            const tipos = form.data_quest.type_inputs;
            res.render("./formularios/dashboard", { id: req.params.id,respostas: form.respostas, mapeamentoCampos: tipos });
        } else {
            res.redirect('/users/login');
        }
    } catch (error) {
        console.log(error);
    }
});

module.exports = router;
