"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable radix */
var express_1 = __importDefault(require("express"));
var mongodb_1 = require("mongodb");
var twilio_util_1 = require("./twilio.util");
var message_model_1 = require("../models/message.model");
var messageTemplate_model_1 = require("../models/messageTemplate.model");
var twilio_1 = require("../keys/twilio");
var outcome_model_1 = require("../models/outcome.model");
var patient_model_1 = require("../models/patient.model");
var auth_1 = __importDefault(require("../middleware/auth"));
if (twilio_1.twilioNumber) {
    var number = twilio_1.twilioNumber.replace(/[^0-9\.]/g, '');
}
else {
    var number = "MISSING";
    console.log("No phone number found in env vars!");
}
var twilio = require('twilio')(twilio_1.accountSid, twilio_1.authToken);
var bodyParser = require('body-parser');
var router = express_1.default.Router();
router.use(bodyParser.urlencoded({ extended: true }));
var responseMap = new Map();
var getPatientIdFromNumber = function (number) {
    return patient_model_1.Patient.findOne({ phoneNumber: number }).select('_id language')
        .then(function (patientId) {
        if (!patientId)
            console.log("'No patient found for phone number " + number + " !'");
        return patientId;
    })
        .catch(function (err) {
        return (err.message);
    });
};
// function to add responses to the Map 
function setResponse(key, response) {
    responseMap.set(key, response);
}
function initializeState() {
    setResponse('many nums', { english: 'Hi, it looks like you sent more than one number. Please send one number in each message.',
        spanish: 'Hi, it looks like you sent more than one number. Please send one number in each message. (Spanish)' });
    setResponse('toolow', { english: 'Your measurement is less than 70. A level less than 70 is low and can harm you. \nTo raise your sugar levels, we recommend you eat or drink sugar now. Try fruit juice with sugar, sugary soda, eat four pieces of candy with sugar. \nAfter 15 minutes, check your sugar levels and text us your measurement. \nIf you continue to measure less than 70, seek urgent medical help.',
        spanish: 'Your number today is too low (Spanish)' });
    setResponse('<80', { english: 'Thank you! How are you feeling? If you feel - sleepy, sweaty, pale, dizzy, irritable, or hungry - your sugar may be too low.\nPlease consume sugar (like juice) to raise your sugars to 80 or above.',
        spanish: 'Your number today is between 70 and 80 (Spanish)' });
    setResponse('green', { english: 'Congratulations! You’re in the green today - keep it up!',
        spanish: 'Green (Spanish)' });
    setResponse('yellow', { english: 'Thank you! You’re in the yellow today - what is one thing you can do to help you lower your glucose levels for tomorrow?',
        spanish: 'Yellow (Spanish)' });
    setResponse('red', { english: 'Thank you! You’re in the red today - your sugars are high. What can you do to lower your number for tomorrow??',
        spanish: 'Red (Spanish)' });
    setResponse('>=301', { english: 'Your measurement is over 300. Fasting blood glucose levels of 300 or more can be dangerous.\nIf you have two readings in a row of 300 or more or are worried about how you feel, call your doctor.',
        spanish: 'Too high (it is greater than 300!) Plesae respond with a valid measurment (Spanish)' });
    setResponse('no', { english: 'Hi, were you able to measure your sugar today? If you need any help with measuring your sugar, please tell your coach.',
        spanish: 'You have entered no measurement (Spanish)' });
    setResponse('catch', { english: 'Hi, I don’t recognize this. Please send a number in your message for us to track your sugar. Thanks!',
        spanish: 'Please respond with a valid input. (Spanish)' });
}
initializeState();
router.post('/sendMessage', auth_1.default, function (req, res) {
    var contnet = req.body.message;
    var recept = req.body.to;
    var patientID = new mongodb_1.ObjectId(req.body.patientID);
    var date = new Date();
    twilio.messages
        .create({
        body: contnet,
        from: number,
        to: recept
    });
    var outgoingMessage = new message_model_1.Message({
        sent: true,
        phoneNumber: number,
        patientID: patientID,
        message: contnet,
        sender: 'COACH',
        date: date
    });
    outgoingMessage.save().then(function () {
        res.status(200).send({
            success: true,
            msg: outgoingMessage
        });
    }).catch(function (err) { return console.log(err); });
});
// this route receives and parses the message from one user, then responds accordingly with the appropriate output 
router.post('/reply', function (req, res) {
    var MessagingResponse = require('twilio').twiml.MessagingResponse;
    var twiml = new MessagingResponse();
    var message = twiml.message();
    if (req.body.Body) {
        var response = req.body.Body;
    }
    else {
        response = "Invalid Text (image)";
    }
    // generate date 
    var date = new Date();
    getPatientIdFromNumber(req.body.From.slice(2)).then(function (patient) {
        var language = patient.language.toLowerCase();
        var patientId = new mongodb_1.ObjectId(patient._id);
        var incomingMessage = new message_model_1.Message({
            sent: true,
            phoneNumber: req.body.To,
            patientID: patientId,
            message: response,
            sender: 'PATIENT',
            date: date
        });
        incomingMessage.save();
        // if contains many numbers then respond with "too many number inputs"
        // this is a bad outcome, only add to message log
        if (twilio_util_1.containsMany(response)) {
            var outgoingMessage = new message_model_1.Message({
                sent: true,
                phoneNumber: req.body.To,
                patientID: patientId,
                message: responseMap.get('many nums')[language],
                sender: 'BOT',
                date: date
            });
            outgoingMessage.save().then(function () {
                res.writeHead(200, { 'Content-Type': 'text/xml' });
                res.end(twiml.toString());
                message.body(responseMap.get('many nums')[language]);
            });
            //Measurement found
        }
        else if (twilio_util_1.containsNumber(response)) {
            var value_1 = twilio_util_1.getNumber(response);
            if (twilio_util_1.classifyNumeric(value_1) === "green" || twilio_util_1.classifyNumeric(value_1) === "yellow" || twilio_util_1.classifyNumeric(value_1) === "red") {
                var outcome = new outcome_model_1.Outcome({
                    phoneNumber: req.body.From,
                    patientID: patientId,
                    response: response,
                    value: value_1[0],
                    alertType: twilio_util_1.classifyNumeric(value_1),
                    date: date
                });
                patient_model_1.Patient.findByIdAndUpdate(patientId, { $inc: { responseCount: 1 } }).catch(function (err) { return console.log(err); });
                outcome.save().then(function () {
                });
                var classification = twilio_util_1.classifyNumeric(value_1);
                var typeUpperCase = classification.charAt(0).toUpperCase() + classification.slice(1);
                var upperLang = language.charAt(0).toUpperCase() + language.slice(1);
                messageTemplate_model_1.MessageTemplate.find({ language: upperLang, type: typeUpperCase }).then(function (messages) {
                    var randomVal = Math.floor(Math.random() * ((messages.length) - 0));
                    var messageTemp = messages[randomVal];
                    var outgoingMessage = new message_model_1.Message({
                        sent: true,
                        phoneNumber: req.body.To,
                        patientID: patientId,
                        message: messageTemp.text,
                        sender: 'BOT',
                        date: date
                    });
                    outgoingMessage.save();
                    message.body(messageTemp.text);
                }).catch(function (err) {
                    var outgoingMessage = new message_model_1.Message({
                        sent: true,
                        phoneNumber: req.body.To,
                        patientID: patientId,
                        message: responseMap.get(twilio_util_1.classifyNumeric(value_1))[language],
                        sender: 'BOT',
                        date: date
                    });
                    outgoingMessage.save();
                    message.body(responseMap.get(twilio_util_1.classifyNumeric(value_1))[language]);
                }).finally(function () {
                    res.writeHead(200, { 'Content-Type': 'text/xml' });
                    res.end(twiml.toString());
                });
            }
            else {
                var outgoingMessage = new message_model_1.Message({
                    sent: true,
                    phoneNumber: req.body.To,
                    patientID: patientId,
                    message: responseMap.get(twilio_util_1.classifyNumeric(value_1))[language],
                    sender: 'BOT',
                    date: date
                });
                outgoingMessage.save().then(function () {
                    message.body(responseMap.get(twilio_util_1.classifyNumeric(value_1))[language]);
                    res.writeHead(200, { 'Content-Type': 'text/xml' });
                    res.end(twiml.toString());
                });
            }
            //Message is "no"
        }
        else if (response.toLowerCase() === ('no')) {
            var outgoingMessage = new message_model_1.Message({
                sent: true,
                phoneNumber: req.body.To,
                patientID: patientId,
                message: responseMap.get('no')[language],
                sender: 'BOT',
                date: date
            });
            outgoingMessage.save().then(function () {
                message.body(responseMap.get('no')[language]);
                res.writeHead(200, { 'Content-Type': 'text/xml' });
                res.end(twiml.toString());
            });
            //catch all
        }
        else {
            var outgoingMessage = new message_model_1.Message({
                sent: true,
                phoneNumber: req.body.To,
                patientID: patientId,
                message: responseMap.get('catch')[language],
                sender: 'BOT',
                date: date
            });
            outgoingMessage.save().then(function () {
                message.body(responseMap.get('catch')[language]);
                res.writeHead(200, { 'Content-Type': 'text/xml' });
                res.end(twiml.toString());
            });
        }
    });
});
exports.default = router;
