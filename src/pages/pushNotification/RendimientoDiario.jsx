import ChannelRendimientoDiario from "../ChannelRendimientoDiario";
import data from "../../data/pushNotification/rendimientoDiario.json";

export default function PushNotificationRendimientoDiario() {
  return <ChannelRendimientoDiario data={data} />;
}
