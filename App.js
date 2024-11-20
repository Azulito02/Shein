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

  const validarFormulario = () => {
    if (!cliente.trim()) {
      Alert.alert('Todos los campos son obligatorios', 'El campo Cliente es obligatorio.');
      return false;
    }
  
    
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!fechaRegex.test(fecha)) {
      Alert.alert('Todos los campos son obligatorios', 'La fecha debe tener el formato adecuado.');
      return false;
    }
  
    
    if (!monto || isNaN(monto) || parseFloat(monto) <= 0) {
      Alert.alert('Todos los campos son obligatorios', 'El monto debe ser un número mayor a 0.');
      return false;
    }
  
    if (!estado.trim()) {
      Alert.alert('Todos los campos son obligatorios', 'El campo Estado es obligatorio.');
      return false;
    }
  
    
    if (!imagen) {
      Alert.alert('Todos los campos son obligatorios', 'Debes seleccionar una imagen.');
      return false;
    }
  
    return true;
  };
  
  const agregarFactura = async () => {
    if (!validarFormulario()) return;
  
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
  
  const actualizarFactura = async () => {
    if (!validarFormulario()) return;
  
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

  const generarPDFdeFactura = async (factura) => {
    try {
      const base64Image = factura.imagen ? await FileSystem.readAsStringAsync(factura.imagen, { encoding: 'base64' }) : null;
      const htmlContent = `
        <html>
          <body>
            <h1>Factura de ${factura.cliente}</h1>
            <p><strong>Fecha:</strong> ${factura.fecha}</p>
            <p><strong>Monto:</strong> $${factura.monto}</p>
            <p><strong>Estado:</strong> ${factura.estado}</p>
            ${base64Image ? `<img src="data:image/jpeg;base64,${base64Image}" style="width: 100%; max-width: 300px; margin-top: 20px;" />` : '<p>Sin imagen</p>'}
          </body>
        </html>
      `;
      const { uri: pdfUri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(pdfUri);
    } catch (error) {
      console.error("Error al generar el PDF de la factura:", error);
      Alert.alert("Error", "No se pudo generar el PDF de la factura.");
    }
  };

  const renderFactura = ({ item }) => (
    <View style={styles.facturaItem}>
      <Text style={styles.facturaText}>Cliente: {item.cliente}</Text>
      <Text style={styles.facturaText}>Fecha: {item.fecha}</Text>
      <Text style={styles.facturaText}>Monto: C${item.monto}</Text>
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
        <TouchableOpacity onPress={() => generarPDFdeFactura(item)} style={styles.actionButton}>
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
        color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`, 
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
      <Text style={styles.title}>A las 7 cierro pedido
      </Text>
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

      <TouchableOpacity style={styles.floatingButton} onPress={() => abrirFormulario()}>
        <MaterialIcons name="add-circle" size={60} color="#007bff" />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedFactura ? 'Editar Factura' : 'Nueva Factura'}</Text>
            <TextInput style={styles.input} placeholder="Cliente" value={cliente} onChangeText={setCliente} />
            <TextInput style={styles.input} placeholder="Fecha" value={fecha} onChangeText={setFecha} />
            <TextInput style={styles.input} placeholder="Monto" value={monto} onChangeText={setMonto} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Estado" value={estado} onChangeText={setEstado} />
            <TouchableOpacity style={styles.button} onPress={pickImage}>
              <Text style={styles.buttonText}>Seleccionar Nueva Imagen</Text>
            </TouchableOpacity>
            {imagen && <Image source={{ uri: imagen }} style={styles.selectedImage} />}
            <TouchableOpacity style={styles.button} onPress={selectedFactura ? actualizarFactura : agregarFactura}>
              <Text style={styles.buttonText}>{selectedFactura ? 'Actualizar Factura' : 'Guardar Factura'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={limpiarFormulario}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonText: {
    marginLeft: 5,
    fontSize: 14,
    color: '#007bff',
  },
  statsButton: {
    backgroundColor: '#1e90ff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 20,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    elevation: 5,
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
  cancelButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 10,
  },
});
