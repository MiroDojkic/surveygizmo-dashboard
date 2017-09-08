const { auth0 } = require('../config/main');
const surveyGizmo = require('../lib/SurveyGizmo');
const EdxApi = require('../lib/EdxApi');
const Auth0ApiClient = require('../lib/auth0Api');
const Mailer = require('../lib/mailer');
const { UserDataException } = require('../lib/customExceptions');
const SurveyResponse = require('../models/surveyResponse');

const authApiClient = Auth0ApiClient(auth0);
const resetPasswordEmail =
  'Please reset your Kauffman FastTrac account by clicking the link: ';

const approveResponse = (req, res, next) => {
  const { access_token: accessToken } = req.session.token;
  const { email, emailContent } = req.body;
  const { responseId } = req.params;

  SurveyResponse.getByEmail(email)
    .then(surveyResponse => {
      if (surveyResponse && isApprovedOrRejected(surveyResponse)) {
        return res.send(surveyResponse);
      }

      /**
     * Catch {UserDataException} if doApproveResponse throws one,
     * otherwise continue with promise chain
     */
      return doApproveResponse(emailContent, responseId, accessToken, req)
        .catch(UserDataException, exception => {
          res.status(400).send(exception.message);
        })
        .then(response => res.send(response))
        .catch(error => res.status(500).send(error));
    })
    .catch(error => next(error));
};

const isApprovedOrRejected = ({ status }) =>
  status &&
  ((status.accountCreated && status.sentPasswordReset) || status.rejected);

/**
 * Function does all the approval logic through the chain of promises.
 *
 * Once the response data is fetched from db,
 * createAccount is called from EdxApi and response status is updated in db.
 *
 * Return value of createAccount is destructured into:
 * {isCreated} - boolean indicating whether account was created in edX or already existed
 * {form} - holds account info
 * Only if account was created reset password email is sent
 *
 * @param {string} emailContent for email sent on response approval
 * @param {number} responseId used to fetch response data from db
 * @param {string} token fetched from session, used to login current user into edX
 */
const doApproveResponse = async (emailContent, responseId, token, req) => {
  const data = await surveyGizmo.getResponseData(responseId);
  const email = data.questions['Submitter Email'];
  let response = await SurveyResponse.findOne({
    'questions.Submitter Email': email
  });

  if (!response) {
    response = new SurveyResponse();
  }

  try {
    await authApiClient.createUser(email, 'passverd');
    await response.setAccountCreated();
  } catch (e) {
    console.log('Failed to create user.\n', e.stack);
  }
  await response.setData(data);

  const resetPasswordEmail = `${resetPasswordEmail} ${await authApiClient.getResetPasswordLink(
    email
  )}`;

  await sendResetPasswordEmail(email, resetPasswordEmail);
  await sendApprovalEmail(email, emailContent);
  await response.setSentPasswordReset();

  await EdxApi.createAffiliateEntity(req, response.questions);

  return response;
};

const sendResetPasswordEmail = (email, content) =>
  Mailer.send({
    to: email,
    subject: 'Password reset link for Kauffman FastTrac account',
    text: content,
    html: content
  });

const sendApprovalEmail = (email, content) =>
  Mailer.send({
    to: email,
    subject: 'Kauffman FastTrac Affiliate Approval',
    text: content,
    html: content
  });

const rejectResponse = (req, res, next) => {
  const { email, emailContent } = req.body;
  let data;
  let surveyResponse;

  return surveyGizmo
    .getResponseData(req.params.responseId)
    .then(responseData => {
      data = responseData;
    })
    .then(() =>
      SurveyResponse.findOne({
        'questions.Submitter Email': data.questions['Submitter Email']
      })
    )
    .then(response => {
      if (!response) {
        surveyResponse = new SurveyResponse();
      } else {
        surveyResponse = response;
      }
    })
    .then(() => surveyResponse.setData(data))
    .then(() => surveyResponse.setRejected())
    .then(() =>
      Mailer.send({
        to: email,
        subject: 'FastTrac Application Rejected',
        text: emailContent,
        html: emailContent
      })
    )
    .then(() => res.send(surveyResponse))
    .catch(error => next(error));
};

module.exports = { approveResponse, rejectResponse };
