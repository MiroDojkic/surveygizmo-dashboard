/* eslint-disable */
const React = require('react');
const ErrorModal = require('../../modals/errorModal/errorModal.jsx');
const responsesStore = require('../../../../stores/responses');
const responseActions = require('../../../../actions/response');

class FormResponseDetails extends React.Component {
  constructor() {
    super();

    this.onResponseChange = this.onResponseChange.bind(this);

    this.state = { response: responsesStore.getViewResponse() };
  }

  componentDidMount() {
    responsesStore.addChangeListener(this.onResponseChange, this);
  }

  componentWillUnmount() {
    responsesStore.removeChangeListener(this.onResponseChange, this);
  }

  onResponseChange() {
    const response = responsesStore.getViewResponse();
    this.setState({ response });
  }

  render() {
    const { response } = this.state;
    if (!response) return null;

    const { questions } = response;
    const isApprovedOrRejected = response.statusString === 'Approved' || response.statusString === 'Rejected';
    const noop = Function.prototype;

    if (isApprovedOrRejected) {
      var approveButton = <button className="no-print" onClick={noop} disabled>Approve</button>; // eslint-disable-line
      var rejectButton = <button className="no-print" onClick={noop} disabled>Reject</button>; // eslint-disable-line
    } else {
      var approveButton = <button className="no-print" onClick={() => this.props.showApproveModal(response)}>Approve</button>; // eslint-disable-line
      var rejectButton = <button className="no-print" onClick={() => this.props.showRejectModal(response)}>Reject</button>; // eslint-disable-line
    }

    return (
      <div className="form-response-details">
        <ErrorModal />
        <div className="content">
          <h1>
            {response.statusString}
          </h1>
          {
            Object.keys(questions).map(key =>
              <p key={`view-response-details-${response.id}-${key}`}>
                <b>{key}</b>
                {questions[key]}
              </p>
            )
          }
        </div>
        <button className="no-print" onClick={responseActions.closeViewResponse}>Close</button>
        <button className="no-print" onClick={window.print}>Print</button>
        {approveButton}
        {rejectButton}
      </div>
    );
  };
}

FormResponseDetails.propTypes = {
  showApproveModal: React.PropTypes.func.isRequired,
  showRejectModal: React.PropTypes.func.isRequired
};

module.exports = FormResponseDetails;
