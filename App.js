import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Alert, FlatList, Image, StyleSheet, TouchableOpacity, Modal, TextInput, Dimensions } from 'react-native';
import { db } from './BD/firebaseconfig';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { MaterialIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { captureRef } from "react-native-view-shot";
import { PieChart } from "react-native-chart-kit";

export default function Facturacion() {
  const [facturas, setFacturas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [cliente, setCliente] = useState('');
  const [fecha, setFecha] = useState('');
  const [monto, setMonto] = useState('');
  const [estado, setEstado] = useState('');
  const [imagen, setImagen] = useState(null);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [chartData, setChartData] = useState([]);
  const chartRef = useRef();

  useEffect(() => {
    cargarFacturas();
  }, []);

  const cargarFacturas = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'facturas'));
      const facturasArray = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setFacturas(facturasArray);
    } catch (error) {
      console.error("Error al cargar las facturas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const abrirFormulario = (factura = null) => {
    if (factura) {
      setSelectedFactura(factura);
      setCliente(factura.cliente);
      setFecha(factura.fecha);
      setMonto(factura.monto.toString());
      setEstado(factura.estado);
      setImagen(factura.imagen);
    } else {
      limpiarFormulario();
    }
    setModalVisible(true);
  };

  const limpiarFormulario = () => {
    setCliente('');
    setFecha('');
    setMonto('');
    setEstado('');
    setImagen(null);
    setSelectedFactura(null);
    setModalVisible(false);
  };

  const agregarFactura = async () => {
    setIsLoading(true);
    try {
      await addDoc(collection(db, 'facturas'), {
        cliente,
        fecha,
        monto: parseFloat(monto),
        estado,
        imagen,
      });
      limpiarFormulario();
      cargarFacturas();
    } catch (error) {
      console.log("Error al agregar la factura:", error);
      Alert.alert('Error', 'No se pudo agregar la factura');
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        setImagen(uri);
      }
    } catch (error) {
      console.error("Error al seleccionar la imagen:", error);
    }
  };

  const convertirImagenBase64 = async (uri) => {
    try {
      return await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (error) {
      console.error("Error al convertir la imagen a base64:", error);
      return null;
    }
  };

  const actualizarFactura = async () => {
    if (!selectedFactura) return;
    setIsLoading(true);
    try {
      const facturaRef = doc(db, 'facturas', selectedFactura.id);
      await updateDoc(facturaRef, {
        cliente,
        fecha,
        monto: parseFloat(monto),
        estado,
        imagen,
      });
      limpiarFormulario();
      cargarFacturas();
    } catch (error) {
      console.log("Error al actualizar la factura:", error);
      Alert.alert('Error', 'No se pudo actualizar la factura');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmarEliminacion = (facturaId) => {
    Alert.alert(
      "Confirmación de eliminación",
      "¿Estás seguro de que deseas eliminar esta factura?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => eliminarFactura(facturaId) }
      ]
    );
  };

  const eliminarFactura = async (facturaId) => {
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, 'facturas', facturaId));
      cargarFacturas();
      Alert.alert("Eliminado", "La factura ha sido eliminada exitosamente.");
    } catch (error) {
      console.log("Error al eliminar la factura:", error);
      Alert.alert('Error', 'No se pudo eliminar la factura');
    } finally {
      setIsLoading(false);
    }
  };

  const renderFactura = ({ item }) => (
    <View style={styles.facturaItem}>
      <Text style={styles.facturaText}>Cliente: {item.cliente}</Text>
      <Text style={styles.facturaText}>Fecha: {item.fecha}</Text>
      <Text style={styles.facturaText}>Monto: ${item.monto}</Text>
      <Text style={styles.facturaText}>Estado: {item.estado}</Text>
      {item.imagen ? (
        <Image source={{ uri: item.imagen }} style={styles.facturaImage} />
      ) : (
        <Text style={styles.facturaText}>No hay imagen</Text>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={() => abrirFormulario(item)} style={styles.actionButton}>
          <MaterialIcons name="edit" size={24} color="blue" />
          <Text style={styles.actionButtonText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => generarPDF(item)} style={styles.actionButton}>
          <MaterialIcons name="picture-as-pdf" size={24} color="purple" />
          <Text style={styles.actionButtonText}>Generar PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => confirmarEliminacion(item.id)} style={styles.actionButton}>
          <MaterialIcons name="delete" size={24} color="red" />
          <Text style={styles.actionButtonText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const fetchFacturaDataForStats = async () => {
    try {
      const facturasSnapshot = await getDocs(collection(db, "facturas"));
      const facturasData = facturasSnapshot.docs.map((doc) => doc.data());

      const chartData = facturasData.map((factura) => ({
        name: factura.cliente,
        cantidad: parseFloat(factura.monto),
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        legendFontColor: "#7F7F7F",
        legendFontSize: 15,
      }));

      setChartData(chartData);
    } catch (error) {
      console.error("Error al obtener los datos de las facturas: ", error);
    }
  };

  const abrirEstadisticas = () => {
    fetchFacturaDataForStats();
    setStatsModalVisible(true);
  };

  const generarPDFdelGrafico = async () => {
    try {
      const uri = await captureRef(chartRef, {
        format: "png",
        quality: 1,
      });
      const htmlContent = `
        <html>
          <body style="display: flex; justify-content: center; align-items: center; height: 100vh;">
            <img src="data:image/png;base64,${await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })}" style="width: 100%; max-width: 500px;" />
          </body>
        </html>
      `;
      const { uri: pdfUri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(pdfUri);
    } catch (error) {
      console.error("Error al generar el PDF del gráfico:", error);
      Alert.alert("Error", "No se pudo generar el PDF del gráfico.");
    }
  };

  

  return (
    <View style={styles.container}>
      <Text style={styles.title}>A las 7 cierro pedido</Text>
      <FlatList
        data={facturas}
        renderItem={renderFactura}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.facturaList}
      />

      {isLoading && <ActivityIndicator size="large" color="#0000ff" />}

      <TouchableOpacity style={styles.statsButton} onPress={abrirEstadisticas}>
        <Text style={styles.buttonText}>Ver Estadísticas</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={statsModalVisible}
        onRequestClose={() => setStatsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Estadísticas de Facturación</Text>
            <View ref={chartRef} collapsable={false} style={styles.chartContainer}>
              <PieChart
                data={chartData}
                width={Dimensions.get("window").width - 50}
                height={250}
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#eff3ff",
                  backgroundGradientTo: "#efefef",
                  color: (opacity = 1) => `rgba(0, 0, 255, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor={"cantidad"}
                backgroundColor={"transparent"}
                paddingLeft={"15"}
                absolute
              />
            </View>
            <TouchableOpacity style={styles.button} onPress={generarPDFdelGrafico}>
              <Text style={styles.buttonText}>Generar PDF del Gráfico</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => setStatsModalVisible(false)}>
              <Text style={styles.buttonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f2f2f2',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10,
    textAlign: 'center',
  },
  facturaList: {
    paddingBottom: 10,
  },
  facturaItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  facturaText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  facturaImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginTop: 10,
  },
  statsButton: {
    backgroundColor: '#1e90ff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  chartContainer: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
