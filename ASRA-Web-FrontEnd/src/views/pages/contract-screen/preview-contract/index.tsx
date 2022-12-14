import classnames from "classnames/bind";
import styles from "./index.module.scss";
import { Form, Row, Col } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import Button from "components/Layout/components/Button";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useRef, useState, useContext } from "react";
import { CreateContractRequestBody } from "models/Contract";
import { createContract, requestTerminateContract } from "api/contract";
import moment from "moment";
import { openNotification } from "components/helper/Notification";
import { ERROR, SUCCESS } from "commons/constants/Notification";
import { CONTRACT_STATUS, NOTIFICATION_TYPE } from "commons/constants";
import { useReactToPrint } from "react-to-print";
import SignaturePad from "react-signature-canvas";
import "./index.scss";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "commons/utils/firebase";
import { v4 } from "uuid";
import ModalConfirm from "components/helper/ModalConfirm";
import { Link } from "react-router-dom";
import { SocketContext } from "app/socket";

const cx = classnames.bind(styles);

export default function PreviewContract({
  currentViewDetailDataContract,
}: any) {
  const parse = require("html-react-parser");
  const navigate = useNavigate();
  const params = useParams();
  const { state }: any = useLocation();
  const [dataContract, setDataContract] = useState<any>();
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [isModalSignVisible, setIsModalSignVisible] = useState(false);
  const [isModalConfirmVisible, setIsModaConfirmlVisible] = useState(false);
  const [isModalConfirmTerminateVisible, setIsModaConfirmTerminateVisible] =
    useState(false);
  const [disabledButton, setDisabledButton] = useState(false);
  const dateFormat = "MMM DD, YYYY";
  const userInforId: any = JSON.parse(
    localStorage.getItem("userInfor") || ""
  ).id;
  const contractContentPDFRef = useRef<any>();
  let sigPad: any = {};
  const socket = useContext(SocketContext);
  const userInfoForSocket = JSON.parse(localStorage.getItem("userInfor") || "");

  const convertToDate = (dateString: string) => {
    //  Convert a "dd/MM/yyyy" string into a Date object
    let d = dateString.split("-");
    let dat = new Date(d[2] + "-" + d[1] + "-" + d[0]);
    return dat;
  };

  //View detail data contract
  useEffect(() => {
    if (currentViewDetailDataContract) {
      setDataContract(currentViewDetailDataContract);
    }
  }, [currentViewDetailDataContract]);

  useEffect(() => {
    if (state) {
      if (state.dataContract) {
        setDataContract(state.dataContract);
      }
    }
  }, [state]);

  const handleCreateContract = (innkeeperSignature: string) => {
    let createContractRequestBody: CreateContractRequestBody;
    createContractRequestBody = {
      ...dataContract,
      contractCreateDate: moment(
        dataContract.contractCreateDate,
        dateFormat
      ).toDate(),
      endDate: moment(dataContract.endDate, dateFormat).toDate(),
      innkeeperBirthdate: moment(
        dataContract.innkeeperBirthdate,
        dateFormat
      ).toDate(),
      innkeeperDateOfIssuanceOfIdentityCard: moment(
        dataContract.innkeeperDateOfIssuanceOfIdentityCard,
        dateFormat
      ).toDate(),
      startDate: moment(dataContract.startDate, dateFormat).toDate(),
      tenantBirthday: moment(dataContract.tenantBirthday, dateFormat).toDate(),
      tenantIcIssueDate: moment(
        dataContract.tenantIcIssueDate,
        dateFormat
      ).toDate(),
      accountTenantId: state.accountTenantId,
      roomId: +state.roomId,
      innkeeperSignature: innkeeperSignature,
    };

    createContract(createContractRequestBody)
      .then((res) => {
        setDisabledButton(false);
        openNotification(SUCCESS, res.message.message.messageDetail);
        setIsModalVisible(false);
        
        socket.emit("sendNotification", {
          roomId: +state?.roomId,
          senderId: userInfoForSocket?.id,
          contractId: res.id ? Number(res.id) : null,
          senderName: userInfoForSocket?.username,
          receiverName: state?.receiver,
          message: `has created a contract for the room at ${dataContract?.contractCreateAddress}.`,
          type: NOTIFICATION_TYPE.CREATE_CONTRACT,
          thumbnail: userInfoForSocket?.image && userInfoForSocket?.image,
        });
        navigate(`/contract/detail/${res.id}`);
      })
      .catch((res) => {
        setDisabledButton(false);
      });
  };

  const handleBackClick = () => {
    navigate("/contract/new", {
      state: state,
    });
  };

  const createContractSubmit = () => {
    setIsModalSignVisible(true);
  };

  const printPDF = (e: any) => {
    e.preventDefault();
    handlePrint();
  };

  const requestTerminate = () => {
    setIsModaConfirmTerminateVisible(true);
  };

  const handleModalConfirmTerminateClick = () => {
    requestTerminateContract(currentViewDetailDataContract.contractId).then(
      (res: any) => {
        setIsModaConfirmTerminateVisible(false)
        openNotification(SUCCESS, res.message.message.messageDetail);
      }
    );
  };

  const handlePrint = useReactToPrint({
    content: () => contractContentPDFRef.current,
  });

  const handleSignOk = () => {
    if (sigPad.isEmpty()) {
      openNotification(ERROR, "Please signature contract before submitting.");
    } else {
      setIsModaConfirmlVisible(true);
    }
  };

  const handleModalConfirmClick = () => {
    setDisabledButton(true);
    const signatureImage = sigPad.getTrimmedCanvas().toDataURL("image/png");
    urlToBlob(signatureImage).then((blob) => {
      handleUploadFileFirebase(blob).then((res: any) => {        
        if (!currentViewDetailDataContract) {
          handleCreateContract(res);
        } else {
          const notificationData = {
            roomId: +state?.roomId,
            senderId: userInfoForSocket?.id,
            contractId: res.id ? Number(res.id) : null,
            senderName: userInfoForSocket?.username,
            receiverName: state?.receiverName,
            message: `signed a contract for the room at ${dataContract?.contractCreateAddress}.`,
            type: NOTIFICATION_TYPE.SIGN_CONTRACT,
            thumbnail: userInfoForSocket?.image && userInfoForSocket?.image,
          };
          navigate(`/contract/detail/${res.id}`);
          navigate(`/payment/bill/${dataContract.billId}`, {
            state: {
              tenantSignature: res,
              notificationData: notificationData,
            },
          });
        }
      });
    });
  };

  const handleUploadFileFirebase = (imageUpload: any) => {
    let metadata = {
      contentType: ["image/jpeg", "image/png"],
    };
    let imageRef = ref(storage, `signature/signature_${v4()}`);
    let uploadTask = uploadBytesResumable(imageRef, imageUpload);
    if (Object.getPrototypeOf(imageUpload) === Object.prototype) {
      return Promise.resolve(null);
    }
    // Listen for state changes, errors, and completion of the upload.
    let imageUploadPromise = new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          switch (snapshot.state) {
            case "paused":
              break;
            case "running":
              break;
          }
        },
        (error) => {
          switch (error.code) {
            case "storage/unauthorized":
              // User doesn't have permission to access the object
              break;
            case "storage/canceled":
              // User canceled the upload
              break;
            case "storage/unknown":
              // Unknown error occurred, inspect error.serverResponse
              break;
          }
        },
        async () => {
          // Get images uploaded from firebase
          await getDownloadURL(uploadTask.snapshot.ref)
            .then((downloadURL) => {
              resolve(downloadURL);
              return downloadURL;
            })
            .catch((err) => reject(err))
            .finally(() => {});
        }
      );
    });

    return imageUploadPromise;
  };

  function urlToBlob(url: string) {
    return new Promise((resolve, reject) => {
      var xhr = new XMLHttpRequest();
      xhr.onerror = reject;
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          resolve(xhr.response);
        }
      };
      xhr.open("GET", url);
      xhr.responseType = "blob"; // convert type
      xhr.send();
    });
  }

  const handleSignCancel = () => {
    setIsModalSignVisible(false);
  };

  const handleSignClear = () => {
    sigPad.clear();
  };

  const handleSignature = (e: any) => {
    e.preventDefault();
    setIsModalSignVisible(true);
  };

  const format = (data: any) => {
    return data?.toLocaleString("vn-VN");
  };

  return (
    <>
      <div className={cx("contract_screen")} ref={contractContentPDFRef}>
        <Form
          name="basic"
          autoComplete="off"
          layout="vertical"
          onFinish={createContractSubmit}
        >
          <div className={cx("contract_container")}>
            <div className={cx("contract_box")}>
              <Row>
                <Col span={24}>
                  <div className={cx("contract_national_name")}>
                    C???NG H??A X?? H???I CH??? NGH??A VI???T NAM
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_crest")}>
                    ?????c l???p ??? T??? do ??? H???nh ph??c
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_title")}>
                    H???P ?????NG THU?? PH??NG TR???
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_first_text")}>
                    {!dataContract
                      ? "H??m nay: ng??y ... th??ng ... n??m ... ."
                      : `H??m nay: ng??y ${
                          new Date(
                            convertToDate(dataContract?.contractCreateDate)
                          ).getDate()
                        } th??ng ${
                          new Date(
                            convertToDate(dataContract?.contractCreateDate)
                          ).getMonth() + 1
                        } n??m ${new Date(
                          convertToDate(dataContract?.contractCreateDate)
                        ).getFullYear()}`}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")} style={{wordBreak:"break-all"}}>
                    {!dataContract
                      ? "T???i ?????a ch???: .................... ."
                      : `T???i ?????a ch???: ${dataContract.contractCreateAddress} .`}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_first_text")}>
                    Ch??ng t??i g???m:
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")}>
                    1. ?????i di???n b??n cho thu?? ph??ng tr??? (Innkeeper):
                  </div>
                </Col>
                <Col span={6}>
                  <div className={cx("contract_text")}>
                    {!dataContract
                      ? `??ng/b??: .................... .`
                      : `??ng/b??: ${dataContract.innkeeperName}`}
                  </div>
                </Col>
                <Col span={6}>
                  <div className={cx("contract_text")}>
                    {!dataContract
                      ? `Sinh ng??y: .................... .`
                      : `Sinh ng??y: ${dataContract.innkeeperBirthdate}`}
                  </div>
                </Col>
                <Col span={12}>
                  <div className={cx("contract_text")} style={{wordBreak:"break-all"}}>
                    {!dataContract
                      ? `N??i ????ng k?? HK: .................... .`
                      : `N??i ????ng k?? HK: ${dataContract.innkeeperPermanentResidence}.`}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")}>
                    {!dataContract
                      ? ` CMND/CCCD s???: ...................., C???p ng??y: .../.../...`
                      : ` CMND/CCCD s???: ${dataContract.innkeeperIdentityCardNo}, C???p ng??y: ${dataContract.innkeeperDateOfIssuanceOfIdentityCard}.`}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")} style={{wordBreak:"break-all"}}>
                    {!dataContract
                      ? ` T???i: ...................................................... .`
                      : ` T???i: ${dataContract.innkeeperThePlaceIdentityCard}.`}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")}>
                    {!dataContract
                      ? `S??? ??i???n tho???i: .................... .`
                      : `S??? ??i???n tho???i: ${dataContract.innkeeperPhoneNumber}`}
                  </div>
                </Col>
                <Col span={24}>
                  <br></br>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")}>
                    2. B??n thu?? ph??ng tr??? (Tenant):
                  </div>
                </Col>
                <Col span={6}>
                  <div className={cx("contract_text")}>
                    {!dataContract
                      ? `??ng/b??: .................... .`
                      : `??ng/b??: ${dataContract.tenantName.toUpperCase()}`}
                  </div>
                </Col>
                <Col span={6}>
                  <div className={cx("contract_text")}>
                    {!dataContract
                      ? `Sinh ng??y: .................... .`
                      : `Sinh ng??y: ${dataContract.tenantBirthday}`}
                  </div>
                </Col>
                <Col span={12}>
                  <div className={cx("contract_text")} style={{wordBreak:"break-all"}}>
                    {!dataContract
                      ? `N??i ????ng k?? HK: .................... .`
                      : `N??i ????ng k?? HK: ${dataContract.tenantPermanentResidence.toUpperCase()}.`}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")}>
                    {!dataContract
                      ? ` CMND/CCCD s???: ...................., C???p ng??y: .../.../...`
                      : ` CMND/CCCD s???: ${dataContract.tenantIcNo}, C???p ng??y: ${dataContract.tenantIcIssueDate}.`}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")} style={{wordBreak:"break-all"}}>
                    {!dataContract
                      ? ` T???i: ...................................................... .`
                      : ` T???i: ${dataContract.tenantIcIssueLoc.toUpperCase()}.`}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")}>
                    {!dataContract
                      ? `S??? ??i???n tho???i: .................... .`
                      : `S??? ??i???n tho???i: ${dataContract.tenantPhoneNumber}`}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_first_text")}>
                    Sau khi b??n b???c tr??n tinh th???n d??n ch???, hai b??n c??ng c?? l???i,
                    c??ng th???ng nh???t nh?? sau:
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")}>
                    B??n cho thu?? ph??ng tr??? ?????ng ?? cho b??n thu?? ph??ng tr??? thu?? 01
                    ph??ng ??? t???i ?????a ch???:
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")} style={{wordBreak:"break-all"}}>
                    {!dataContract
                      ? `......................................................................`
                      : `${dataContract.contractCreateAddress}.`}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")}>
                    {!dataContract
                      ? `Gi?? thu??: .................... ?????ng/th??ng .`
                      : `Gi?? thu??: ${format(
                          dataContract.rentalPrice
                        )} ?????ng/th??ng.`}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")}>
                    {!dataContract
                      ? `H??nh th???c thanh to??n: .................... .`
                      : `H??nh th???c thanh to??n: Thanh to??n qua ${dataContract.paymentType}.`}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")}>
                    {!dataContract
                      ? `Ti???n ??i???n .................... ?????ng/kwh t??nh theo ch??? s???
                    c??ng t??, thanh to??n v??o cu???i c??c th??ng.`
                      : `Ti???n ??i???n ${format(
                          dataContract.electronicPrice
                        )} ?????ng/kwh t??nh theo ch??? s???
                    c??ng t??, thanh to??n v??o cu???i c??c th??ng.`}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")}>
                    {!dataContract
                      ? `Ti???n n?????c: ................... ?????ng/ng?????i thanh to??n v??o ?????u
                    c??c th??ng.`
                      : `Ti???n n?????c: ${format(
                          dataContract.waterPrice
                        )} ?????ng/ng?????i thanh to??n v??o ?????u
                    c??c th??ng.`}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")}>
                    {!dataContract
                      ? `Ti???n ?????t c???c: .................... ?????ng.`
                      : `Ti???n ?????t c???c: ${format(dataContract.deposit)} ?????ng.`}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")}>
                    {!dataContract
                      ? ` H???p ?????ng c?? gi?? tr??? k??? t??? ng??y ... th??ng ... n??m ... ?????n
                    ng??y ... th??ng ... n??m ... .`
                      : ` H???p ?????ng c?? gi?? tr??? k??? t??? ${dataContract.startDate} ?????n
                    ${dataContract.endDate}.`}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_first_text")}>
                    Tr??ch nhi???m c???a c??c b??n:
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")}>
                    1. Tr??ch nhi???m c???a b??n cho thu?? ph??ng tr??? (Innkeeper):
                  </div>
                </Col>
                <Col span={24}>
                  <div
                    className={cx("contract_text")}
                    style={{ marginLeft: 20 }}
                  >
                    {!dataContract?.innkeeperResponsibility ? (
                      <div>
                        - T???o m???i ??i???u ki???n thu???n l???i ????? b??n B th???c hi???n theo
                        h???p ?????ng.
                        <br></br>- Cung c???p ngu???n ??i???n, n?????c, wifi cho b??n B s???
                        d???ng.
                      </div>
                    ) : (
                      <div style={{wordBreak:"break-all"}}>
                        {parse(
                          `${dataContract?.innkeeperResponsibility?.replaceAll(
                            "\n",
                            "<br>"
                          )}`
                        )}
                      </div>
                    )}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_text")}>
                    2. Tr??ch nhi???m c???a b??n thu?? ph??ng tr??? (Tenant):
                  </div>
                </Col>
                <Col span={24}>
                  <div
                    className={cx("contract_text")}
                    style={{ marginLeft: 20 }}
                  >
                    {!dataContract?.tenantResponsibility ? (
                      <div>
                        - Thanh to??n ?????y ????? c??c kho???n ti???n theo ????ng th???a thu???n.
                        <br></br>- B???o qu???n c??c trang thi???t b??? v?? c?? s??? v???t ch???t
                        c???a b??n A trang b??? cho ban ?????u l??m h???ng ph???i s???a, m???t
                        ph???i ?????n.
                        <br></br>- Kh??ng ???????c t??? ?? s???a ch???a, c???i t???o c?? s??? v???t
                        ch???t khi ch??a ???????c s??? ?????ng ?? c???a b??n A.
                        <br></br>- Gi??? g??n v??? sinh trong v?? ngo??i khu??n vi??n c???a
                        ph??ng tr???. - B??n B ph???i ch???p h??nh m???i quy ?????nh c???a ph??p
                        lu???t Nh?? n?????c v?? quy ?????nh c???a ?????a ph????ng.
                        <br></br>- N???u b??n B cho kh??ch ??? qua ????m th?? ph???i b??o v??
                        ???????c s??? ?????ng ?? c???a ch??? nh?? ?????ng th???i ph???i ch???u tr??ch
                        nhi???m v??? c??c h??nh vi vi ph???m ph??p lu???t c???a kh??ch trong
                        th???i gian ??? l???i.
                      </div>
                    ) : (
                      <div style={{wordBreak:"break-all"}}>
                        {parse(
                          `${dataContract?.tenantResponsibility?.replaceAll(
                            "\n",
                            "<br>"
                          )}`
                        )}
                      </div>
                    )}
                  </div>
                </Col>
                <Col span={24}>
                  <div className={cx("contract_first_text")}>
                    Tr??ch nhi???m chung:
                  </div>
                </Col>
                <Col span={24}>
                  <div
                    className={cx("contract_text")}
                    style={{ marginLeft: 20 }}
                  >
                    {!dataContract?.commonResponsibility ? (
                      <div>
                        - Hai b??n ph???i t???o ??i???u ki???n cho nhau th???c hi???n h???p
                        ?????ng.
                        <br></br>- Trong th???i gian h???p ?????ng c??n hi???u l???c n???u b??n
                        n??o vi ph???m c??c ??i???u kho???n ???? th???a thu???n th?? b??n c??n l???i
                        c?? quy???n ????n ph????ng ch???m d???t h???p ?????ng; n???u s??? vi ph???m
                        h???p ?????ng ???? g??y t???n th???t cho b??n b??? vi ph???m h???p ?????ng th??
                        b??n vi ph???m h???p ?????ng ph???i b???i th?????ng thi???t h???i.
                        <br></br>- M???t trong hai b??n mu???n ch???m d???t h???p ?????ng
                        tr?????c th???i h???n th?? ph???i b??o tr?????c cho b??n kia ??t nh???t 30
                        ng??y v?? hai b??n ph???i c?? s??? th???ng nh???t.
                        <br></br>- B??n A ph???i tr??? l???i ti???n ?????t c???c cho b??n B.
                        <br></br>- B??n n??o vi ph???m ??i???u kho???n chung th?? ph???i
                        ch???u tr??ch nhi???m tr?????c ph??p lu???t.
                        <br></br>- H???p ?????ng ???????c l???p th??nh 02 b???n c?? gi?? tr???
                        ph??p l?? nh?? nhau, m???i b??n gi??? m???t b???n.
                      </div>
                    ) : (
                      <div style={{wordBreak:"break-all"}}>
                        {parse(
                          `${dataContract?.commonResponsibility?.replaceAll(
                            "\n",
                            "<br>"
                          )}`
                        )}
                      </div>
                    )}

                    {/* TODO ng???t d??ng */}
                  </div>
                </Col>
                <Col span={24}>
                  <Row className={cx("contract-row")}>
                    <Col span={12}>
                      <div className={cx("col_left")}>
                        <p>?????i di???n b??n thu?? ph??ng tr???</p>
                        <img
                          style={{ width: "40%" }}
                          src={currentViewDetailDataContract?.tenantSignature}
                        ></img>
                        <p>
                          {currentViewDetailDataContract &&
                          currentViewDetailDataContract?.status !==
                            CONTRACT_STATUS.WAITING_TENANT_CONFIRM
                            ? currentViewDetailDataContract.tenantName.toUpperCase()
                            : ""}
                        </p>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div className={cx("col_right")}>
                        <p>?????i di???n b??n cho thu?? ph??ng tr???</p>
                        <img
                          style={{ width: "40%" }}
                          src={
                            currentViewDetailDataContract?.innkeeperSignature
                          }
                        ></img>
                        <p>
                          {currentViewDetailDataContract
                            ? currentViewDetailDataContract.innkeeperName.toUpperCase()
                            : ""}
                        </p>
                      </div>
                    </Col>
                  </Row>
                </Col>
              </Row>
            </div>
          </div>

          {currentViewDetailDataContract?.status ===
            CONTRACT_STATUS.WAITING_TENANT_CONFIRM &&
            currentViewDetailDataContract?.tenantId === userInforId && (
              <>
                <Form.Item
                  className={styles.form_buton}
                  wrapperCol={{ span: 24 }}
                >
                  {/* Button Create Contract */}
                  {/* <Button
                    primary
                    className={styles.btn_create_contract}
                    onClick={(e: any) => handleSign(e)}
                  >
                    Sign
                  </Button> */}
                  <Button
                    primary
                    className={styles.btn_create_contract}
                    onClick={(e: any) => handleSignature(e)}
                  >
                    Sign
                  </Button>
                </Form.Item>
              </>
            )}

          {!currentViewDetailDataContract && state && (
            <Form.Item className={styles.form_buton} wrapperCol={{ span: 24 }}>
              {/* Button Cancel */}
              <Button
                primary
                className={styles.btn_cancel}
                onClick={() => handleBackClick()}
              >
                Back
              </Button>

              {/* Button Create Contract */}
              <Button
                type="submit"
                primary
                className={styles.btn_create_contract}
              >
                Create Contract
              </Button>
            </Form.Item>
          )}
        </Form>
      </div>
      {currentViewDetailDataContract &&
        currentViewDetailDataContract?.status !==
          CONTRACT_STATUS.WAITING_TENANT_CONFIRM && (
          <Row className={cx("btn-print-section")}>
            <Col span={24}>
              <Button
                primary
                className={styles.btn_create_contract}
                onClick={(e: any) => printPDF(e)}
              >
                Print PDF
              </Button>
              {currentViewDetailDataContract?.status !==
                CONTRACT_STATUS.EXPIRED &&
                +currentViewDetailDataContract.tenantId ===
                  +JSON.parse(localStorage.getItem("userInfor") || "").id && (
                  <Button
                    style={{ marginLeft: "8px", backgroundColor: "#e03c31" }}
                    primary
                    className={styles.btn_create_contract}
                    onClick={(e: any) => requestTerminate()}
                  >
                    Terminate
                  </Button>
                )}
            </Col>
          </Row>
        )}
      <Link
        to={"/manage"}
        state={{
          tabkey: 1,
        }}
      >
        {`<< Back to management page`}
      </Link>
      <ModalConfirm
        title="Confirmation"
        isModalVisible={isModalVisible}
        zIndex={3}
        close={() => setIsModalVisible(false)}
        footer={[
          <Button
            key={1}
            id={1}
            cancel
            small
            onClick={() => setIsModalVisible(false)}
          >
            Cancel
          </Button>,
          <Button key={2} id={2} submit small onClick={handleCreateContract}>
            OK
          </Button>,
        ]}
        children={
          <div style={{ display: "flex", paddingLeft: "16px" }}>
            <ExclamationCircleOutlined
              style={{ fontSize: "22px", color: "#faad14" }}
            />
            <p style={{ paddingLeft: "16px", fontSize: "16px" }}>
              Do you want to create a contract?
            </p>
          </div>
        }
      />

      <ModalConfirm
        title="Signpad"
        className="modal-sign-create-contract"
        width={700}
        zIndex={3}
        marginTop="70px"
        isModalVisible={isModalSignVisible}
        close={handleSignCancel}
        footer={[
          <Button
            key={1}
            id={1}
            disabled={disabledButton}
            danger
            small
            className={styles.modalSignBtn}
            onClick={handleSignClear}
          >
            Clear
          </Button>,
          <Button
            key={2}
            id={2}
            disabled={disabledButton}
            primary
            small
            className={styles.modalSignBtn}
            onClick={handleSignOk}
          >
            Sign
          </Button>,
        ]}
        children={
          <SignaturePad
            canvasProps={{ width: 700, height: 500, className: styles.sigPad }}
            minWidth={1}
            maxWidth={1}
            backgroundColor={"#fff"}
            ref={(ref: any) => {
              sigPad = ref;
            }}
          />
        }
      />
      <ModalConfirm
        title="Confirmation"
        isModalVisible={isModalConfirmVisible}
        zIndex={3}
        close={() => setIsModaConfirmlVisible(false)}
        footer={[
          <Button
            key={1}
            id={1}
            disabled={disabledButton}
            cancel
            small
            onClick={() => setIsModaConfirmlVisible(false)}
          >
            Cancel
          </Button>,
          <Button
            key={2}
            id={2}
            disabled={disabledButton}
            submit
            small
            onClick={() => handleModalConfirmClick()}
          >
            OK
          </Button>,
        ]}
        children={
          <div style={{ display: "flex", paddingLeft: "16px" }}>
            <ExclamationCircleOutlined
              style={{ fontSize: "22px", color: "#faad14" }}
            />
            <p style={{ paddingLeft: "16px", fontSize: "16px" }}>
              {`Do you want to ${
                currentViewDetailDataContract?.tenantId === userInforId
                  ? "sign"
                  : "create"
              } this contract?`}
            </p>
          </div>
        }
      />
      <ModalConfirm
        title="Confirmation"
        isModalVisible={isModalConfirmTerminateVisible}
        zIndex={3}
        close={() => setIsModaConfirmTerminateVisible(false)}
        footer={[
          <Button
            key={1}
            id={1}
            disabled={disabledButton}
            cancel
            small
            onClick={() => setIsModaConfirmTerminateVisible(false)}
          >
            Cancel
          </Button>,
          <Button
            key={2}
            id={2}
            disabled={disabledButton}
            submit
            small
            onClick={() => handleModalConfirmTerminateClick()}
          >
            OK
          </Button>,
        ]}
        children={
          <div style={{ display: "flex", paddingLeft: "16px" }}>
            <ExclamationCircleOutlined
              style={{ fontSize: "22px", color: "#faad14" }}
            />
            <p style={{ paddingLeft: "16px", fontSize: "16px" }}>
              Do you want to request termination of this contract?
            </p>
          </div>
        }
      />
    </>
  );
}
