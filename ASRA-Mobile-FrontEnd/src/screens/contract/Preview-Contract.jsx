import { View } from "native-base";
import { useEffect, useRef, useState } from "react";
import { Image, SafeAreaView, ScrollView, Text } from "react-native";
import { Modal } from "native-base";
import { v4 } from "uuid";
import { storage } from "../../utils/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import * as WebBrowser from "expo-web-browser";

import { currencyViCodeNoIcon } from "../../utils/currency-util";
import { COLORS, TABS } from "../../constants";
import { utcToVNTime } from "../../utils/date-util";
import { getContractDetail } from "../../api/contract";
import { DOMAIN } from "../../constants";

import CustomButton from "../../components/custom/Button";
import Header from "../../components/layout/header/Header";
import FocusedStatusBar from "../../components/layout/focused-status-bar/FocusedStatusBar";
import SignatureScreen from "react-native-signature-canvas";
import Loading from "../../components/loading/Loading";

export default function PreviewContract(props) {
  const refSigPad = useRef();
  const { navigation, route } = props;

  const [contract, setContract] = useState();
  const [contractLoading, setContractLoading] = useState(false);
  const [disableSignBtnFlag, setdisableSignBtnFlag] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [result, setResult] = useState(null);
  const style = `.m-signature-pad--footer {display: none; margin: 0px;}`;
  let sigPad = {};

  useEffect(() => {
    setContractLoading(true);
    getContractDetail(route?.params?.contractId).then((res) => {
      setContract(res);
      setContractLoading(false);
    });
  }, [result]);

  const handleCloseSignature = () => {
    setShowSignatureModal(false);
    sigPad?.clearSignature();
  };

  const handleClearSignature = () => {
    sigPad?.clearSignature();
  };

  const handleSubmitSignature = () => {
    //Trigger call handleOk
    sigPad.readSignature();
  };

  const handleOK = async (signature) => {
    setdisableSignBtnFlag(true);
    urlToBlob(signature).then((blob) => {
      handleUploadFileFirebase(blob).then(async (res) => {
        handleCloseSignature();
        let result = await WebBrowser.openBrowserAsync(
          `${DOMAIN.ONLINE}/payment/bill/native/${contract.billId}?tenantSignUrl=${res}`
        );
        setResult(result?.type);
        setdisableSignBtnFlag(false);
      });
    });
  };

  const handleUploadFileFirebase = (imageUpload) => {
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

  function urlToBlob(url) {
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <FocusedStatusBar backgroundColor={COLORS.primary} />
      <Header title={TABS.contract} navigation={navigation} />
      {contractLoading ? (
        <Loading />
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ paddingTop: 10, paddingHorizontal: 16 }}
          >
            <View>
              <Text
                style={{
                  marginTop: 4,
                  textAlign: "center",
                  fontWeight: "600",
                }}
              >
                C???NG H??A X?? H???I CH??? NGH??A VI???T NAM
              </Text>
              <Text
                style={{
                  textAlign: "center",
                  fontWeight: "400",
                }}
              >
                ?????c l???p ??? T??? do ??? H???nh ph??c
              </Text>
              <Text
                style={{
                  textAlign: "center",
                  marginTop: 20,
                  fontWeight: "bold",
                }}
              >
                H???P ?????NG THU?? PH??NG TR???
              </Text>
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 12,
                }}
              >
                H??m nay: ng??y {new Date(contract?.contractCreateDate).getDate()}{" "}
                th??ng {new Date(contract?.contractCreateDate).getMonth() + 1}{" "}
                n??m {new Date(contract?.contractCreateDate).getFullYear()}
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 12,
                }}
              >
                T???i ?????a ch???: {contract?.contractCreateAddress}
              </Text>
              <Text
                style={{
                  marginTop: 16,
                  fontSize: 12,
                }}
              >
                Ch??ng t??i g???m:
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 12,
                }}
              >
                1. ?????i di???n b??n cho thu?? ph??ng tr??? (Innkeeper):
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 12,
                }}
              >
                ??ng/b??: {contract?.innkeeperName?.toUpperCase()}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 12,
                }}
              >
                Sinh ng??y: {contract?.innkeeperBirthdate}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 12,
                }}
              >
                N??i ????ng k?? HK: {contract?.innkeeperPermanentResidence}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                }}
              >
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: 12,
                  }}
                >
                  CMND/CCCD s???: {contract?.innkeeperIdentityCardNo}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    marginLeft: 20,
                    fontSize: 12,
                  }}
                >
                  C???p ng??y: {contract?.innkeeperDateOfIssuanceOfIdentityCard}
                </Text>
              </View>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 12,
                }}
              >
                T???i: {contract?.innkeeperThePlaceIdentityCard}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 12,
                }}
              >
                S??? ??i???n tho???i: {contract?.innkeeperPhoneNumber}
              </Text>

              {/* Tenant Section */}
              <Text
                style={{
                  marginTop: 16,
                  fontSize: 12,
                }}
              >
                2. ?????i di???n b??n thu?? ph??ng tr??? (Tenant):
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 12,
                }}
              >
                ??ng/b??: {contract?.tenantName?.toUpperCase()}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 12,
                }}
              >
                Sinh ng??y: {utcToVNTime(new Date(contract?.tenantBirthday))}
              </Text>

              <Text
                style={{
                  marginTop: 2,
                  fontSize: 12,
                }}
              >
                N??i ????ng k?? HK: {contract?.tenantPermanentResidence}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                }}
              >
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: 12,
                  }}
                >
                  CMND/CCCD s???: {contract?.tenantIcNo}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    marginLeft: 20,
                    fontSize: 12,
                  }}
                >
                  C???p ng??y: {utcToVNTime(new Date(contract?.tenantIcIssueDate))}
                </Text>
              </View>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 12,
                }}
              >
                T???i: {contract?.tenantIcIssueLoc?.toUpperCase()}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 12,
                }}
              >
                S??? ??i???n tho???i: {contract?.tenantPhoneNumber}
              </Text>

              <Text
                style={{
                  marginTop: 20,
                  fontSize: 12,
                }}
              >
                Sau khi b??n b???c tr??n tinh th???n d??n ch???, hai b??n c??ng c?? l???i,
                c??ng th???ng nh???t nh?? sau:
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 12,
                }}
              >
                B??n cho thu?? ph??ng tr??? ?????ng ?? cho b??n thu?? ph??ng tr??? thu?? 01
                ph??ng ??? t???i ?????a ch???: {contract?.contractCreateAddress}.
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 12,
                }}
              >
                Gi?? thu??: {currencyViCodeNoIcon(contract?.rentalPrice)} ?????ng.
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 12,
                }}
              >
                H??nh th???c thanh to??n: Thanh to??n qua {contract?.paymentType}.
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 12,
                }}
              >
                Ti???n ??i???n: {currencyViCodeNoIcon(contract?.electronicPrice)}{" "}
                ?????ng/kwh t??nh theo ch??? s??? c??ng t??, thanh to??n v??o cu???i c??c
                th??ng.
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 12,
                }}
              >
                Ti???n n?????c: {currencyViCodeNoIcon(contract?.waterPrice)}{" "}
                ?????ng/ng?????i thanh to??n v??o ?????u c??c th??ng.
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 12,
                }}
              >
                Ti???n ?????t c???c: {currencyViCodeNoIcon(contract?.deposit)} ?????ng.
              </Text>

              <Text
                style={{
                  marginTop: 20,
                  fontSize: 12,
                }}
              >
                Tr??ch nhi???m c???a c??c b??n:
              </Text>

              <Text
                style={{
                  marginTop: 8,
                  fontSize: 12,
                }}
              >
                1. Tr??ch nhi???m c???a b??n cho thu?? ph??ng tr??? (Innkeeper):
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 12,
                }}
              >
                {!contract?.innkeeperResponsibility ? (
                  <View>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                      }}
                    >
                      - T???o m???i ??i???u ki???n thu???n l???i ????? b??n B th???c hi???n theo h???p
                      ?????ng.
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                      }}
                    >
                      - Cung c???p ngu???n ??i???n, n?????c, wifi cho b??n B s??? d???ng.
                    </Text>
                  </View>
                ) : (
                  <>
                    {contract?.innkeeperResponsibility?.split("/n").map((x) => (
                      <Text
                        key={x}
                        style={{
                          marginTop: 2,
                          fontSize: 12,
                        }}
                      >
                        {x}
                      </Text>
                    ))}
                  </>
                )}
              </Text>

              <Text
                style={{
                  marginTop: 8,
                  fontSize: 12,
                }}
              >
                2. Tr??ch nhi???m c???a b??n thu?? ph??ng tr??? (Tenant):
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 12,
                }}
              >
                {!contract?.tenantResponsibility ? (
                  <View>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                      }}
                    >
                      - Thanh to??n ?????y ????? c??c kho???n ti???n theo ????ng th???a thu???n.
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                      }}
                    >
                      - B???o qu???n c??c trang thi???t b??? v?? c?? s??? v???t ch???t c???a b??n A
                      trang b??? cho ban ?????u l??m h???ng ph???i s???a, m???t ph???i ?????n.
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                      }}
                    >
                      {" "}
                      Kh??ng ???????c t??? ?? s???a ch???a, c???i t???o c?? s??? v???t ch???t khi ch??a
                      ???????c s??? ?????ng ?? c???a b??n A.
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                      }}
                    >
                      - Gi??? g??n v??? sinh trong v?? ngo??i khu??n vi??n c???a ph??ng tr???.
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                      }}
                    >
                      - B??n B ph???i ch???p h??nh m???i quy ?????nh c???a ph??p lu???t Nh?? n?????c
                      v?? quy ?????nh c???a ?????a ph????ng.
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                      }}
                    >
                      - N???u b??n B cho kh??ch ??? qua ????m th?? ph???i b??o v?? ???????c s???
                      ?????ng ?? c???a ch??? nh?? ?????ng th???i ph???i ch???u tr??ch nhi???m v??? c??c
                      h??nh vi vi ph???m ph??p lu???t c???a kh??ch trong th???i gian ??? l???i.
                    </Text>
                  </View>
                ) : (
                  <>
                    {contract?.tenantResponsibility?.split("/n").map((x) => (
                      <Text
                        key={x}
                        style={{
                          marginTop: 2,
                          fontSize: 11,
                        }}
                      >
                        {x}
                      </Text>
                    ))}
                  </>
                )}
              </Text>

              <Text
                style={{
                  marginTop: 8,
                  fontSize: 12,
                }}
              >
                3. Tr??ch nhi???m chung:
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 12,
                }}
              >
                {!contract?.commonResponsibility ? (
                  <View>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                      }}
                    >
                      - Hai b??n ph???i t???o ??i???u ki???n cho nhau th???c hi???n h???p ?????ng.
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                      }}
                    >
                      - Trong th???i gian h???p ?????ng c??n hi???u l???c n???u b??n n??o vi
                      ph???m c??c ??i???u kho???n ???? th???a thu???n th?? b??n c??n l???i c?? quy???n
                      ????n ph????ng ch???m d???t h???p ?????ng; n???u s??? vi ph???m h???p ?????ng ????
                      g??y t???n th???t cho b??n b??? vi ph???m h???p ?????ng th?? b??n vi ph???m
                      h???p ?????ng ph???i b???i th?????ng thi???t h???i.
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                      }}
                    >
                      - M???t trong hai b??n mu???n ch???m d???t h???p ?????ng tr?????c th???i h???n
                      th?? ph???i b??o tr?????c cho b??n kia ??t nh???t 30 ng??y v?? hai b??n
                      ph???i c?? s??? th???ng nh???t.
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                      }}
                    >
                      - B??n A ph???i tr??? l???i ti???n ?????t c???c cho b??n B.
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                      }}
                    >
                      - B??n n??o vi ph???m ??i???u kho???n chung th?? ph???i ch???u tr??ch
                      nhi???m tr?????c ph??p lu???t.
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                      }}
                    >
                      - H???p ?????ng ???????c l???p th??nh 02 b???n c?? gi?? tr??? ph??p l?? nh??
                      nhau, m???i b??n gi??? m???t b???n.
                    </Text>
                  </View>
                ) : (
                  <>
                    {contract?.commonResponsibility?.split("/n").map((x) => (
                      <Text
                        key={x}
                        style={{
                          marginTop: 2,
                          fontSize: 11,
                        }}
                      >
                        {x}
                      </Text>
                    ))}
                  </>
                )}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  display: "flex",
                  justifyContent: "space-between",
                  padding: 20,
                }}
              >
                <View
                  style={{
                    alignItems: "center",
                  }}
                >
                  <Text>?????i di???n b??n thu??</Text>
                  <Image
                    style={{
                      width: 80,
                      height: 80,
                    }}
                    source={{
                      uri: `${
                        contract?.tenantSignature
                          ? contract?.tenantSignature
                          : "a"
                      }`,
                    }}
                  />
                  <Text>
                    {contract?.tenantSignature
                      ? contract?.tenantName?.toUpperCase()
                      : ""}
                  </Text>
                </View>
                <View
                  style={{
                    alignItems: "center",
                  }}
                >
                  <Text>?????i di???n b??n cho thu??</Text>
                  <Image
                    style={{
                      width: 80,
                      height: 80,
                    }}
                    source={{
                      uri: `${
                        contract?.innkeeperSignature
                          ? contract?.innkeeperSignature
                          : "a"
                      }`,
                    }}
                  />
                  <Text>{contract?.innkeeperName?.toUpperCase()}</Text>
                </View>
              </View>
            </View>
            {!contract?.tenantSignature && (
              <View
                style={{
                  paddingBottom: 40,
                }}
              >
                <CustomButton
                  disabled={disableSignBtnFlag}
                  flex={1}
                  label="Signature"
                  fontSize={14}
                  paddingVertical={10}
                  onPress={() => {
                    setShowSignatureModal(true);
                  }}
                />
              </View>
            )}
          </ScrollView>

          <Modal
            animationPreset="slide"
            isOpen={showSignatureModal}
            onClose={() => handleCloseSignature()}
            size="xl"
          >
            <Modal.Content maxWidth="350">
              <Modal.CloseButton />
              <Modal.Header>
                <Text
                  style={{ fontSize: 16, textAlign: "center", paddingTop: 3 }}
                >
                  Signature
                </Text>
              </Modal.Header>
              <View propagateSwipe={false} style={{ height: 300 }}>
                <SignatureScreen
                  propagateSwipe={false}
                  ref={(refSigPad) => {
                    sigPad = refSigPad;
                  }}
                  webStyle={style}
                  onOK={handleOK}
                  minWidth={1}
                  maxWidth={1}
                />
              </View>
              <Modal.Footer>
                <CustomButton
                  disabled={disableSignBtnFlag}
                  key={1}
                  flex={1}
                  label="Clear"
                  fontSize={14}
                  paddingVertical={10}
                  marginLeft={4}
                  marginRight={4}
                  backgroundColor="#dc3545"
                  onPress={() => {
                    handleClearSignature();
                  }}
                />
                <CustomButton
                  disabled={disableSignBtnFlag}
                  key={2}
                  flex={1}
                  label="Confirm"
                  fontSize={14}
                  paddingVertical={10}
                  marginLeft={4}
                  marginRight={4}
                  onPress={() => {
                    handleSubmitSignature();
                  }}
                />
              </Modal.Footer>
            </Modal.Content>
          </Modal>
        </>
      )}
    </SafeAreaView>
  );
}
