import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import Web3 from 'web3';
import QRCode from 'qrcode';
import crypto from 'crypto';
import pkg from 'pg';
const { Client } = pkg;
import { fileURLToPath } from 'url';

const app = express();
const port = 3001;


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
    user: 'postgres', 
    host: 'localhost',
    database: 'postgres', 
    password: 'enter your password', 
    port: 5432,
  });
  
  client.connect();

app.use(bodyParser.json());

const web3 = new Web3('https://rpc-amoy.polygon.technology/');
  const mfg_abi = [
    {
      "inputs": [
        { "internalType": "uint256", "name": "p_id", "type": "uint256" },
        { "internalType": "string", "name": "p_name", "type": "string" },
        { "internalType": "string", "name": "p_m_date", "type": "string" },
        { "internalType": "string", "name": "p_batch", "type": "string" },
        { "internalType": "string", "name": "p_hash", "type": "string" }
      ],
      "name": "addData",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        { "internalType": "uint256", "name": "p_id", "type": "uint256" }
      ],
      "name": "getData",
      "outputs": [
        { "internalType": "uint256", "name": "", "type": "uint256" },
        { "internalType": "string", "name": "", "type": "string" },
        { "internalType": "string", "name": "", "type": "string" },
        { "internalType": "string", "name": "", "type": "string" },
        { "internalType": "string", "name": "", "type": "string" }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];

  const mfg_contract_address = "0xC444b9197398848CC3Aa865993Bde3FeF743d702";
  const mfg_contract = new web3.eth.Contract(mfg_abi, mfg_contract_address);
  const private_key = "enter private key";
  const wallet_address = "enter wallet address";

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'manufacturer.html')); 
});

app.post('/api/data', async (req, res) => {
  const { p_id, p_name, p_m_date, p_batch } = req.body;
  
  console.log("Received Data: ", p_id, p_name, p_m_date, p_batch);
  res.json({ message: 'Data Received: ' + p_id + p_name + p_m_date + p_batch });

  const hashinput = p_id+p_name+p_m_date+p_batch;
  const hash = crypto.createHash('sha256').update(hashinput).digest('hex');

  

  
  try {
    const transactionData = mfg_contract.methods.addData(p_id, p_name, p_m_date, p_batch,hash).encodeABI();
    const gasPrice = await web3.eth.getGasPrice();
    const nonce = await web3.eth.getTransactionCount(wallet_address);

    const txObject = {
      to: mfg_contract_address,
      gas: 2000000,
      gasPrice: gasPrice,
      nonce: nonce,
      data: transactionData,
    };

    const signTransaction = await web3.eth.accounts.signTransaction(txObject, private_key);
    const sendTransaction = await web3.eth.sendSignedTransaction(signTransaction.rawTransaction);

    console.log('Transaction successful:', sendTransaction);
    const qrCodeBase64 = Buffer.from(hash).toString('base64');
    
    const insertQuery = `INSERT INTO product_data (product_id, product_name, product_m_date, product_hash, qr_code)
                         VALUES ($1, $2, $3, $4, $5)`;
    const insertValues = [p_id, p_name, p_m_date, hash, qrCodeBase64];

    
    await client.query(insertQuery, insertValues);
    console.log('Data inserted into PostgreSQL successfully');
    console.log(qrCodeBase64);
  } catch (error) {
    console.error('Error:', error);
    console.error('Error inserting data into PostgreSQL:', err);
    return res.status(500).json({ message: 'Error inserting data into PostgreSQL' });
  }

});

app.get('/api/getData/:id', async (req, res) => {
    const p_id = req.params.id; 

    try {
       
        const data = await mfg_contract.methods.getData(p_id).call();
        
      
        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

       
        const responseData = {
            p_id: data[0].toString(),      
            p_name: data[1],
            p_m_date: data[2],
            p_batch: data[3],
            p_hash: data[4]
        };

        
        res.json(responseData);

    } catch (error) {
        console.error('Error fetching data from blockchain:', error);
        res.status(500).json({ message: 'Error fetching data from blockchain.' });
    }
});

app.get('/api/getQR/:id', async (req, res) => {
    const p_id = req.params.id;

    console.log(`Fetching QR for Product ID: ${p_id}`);

    try {
        
        const query = 'SELECT qr_code FROM product_data WHERE product_id = $1';
        const result = await client.query(query, [p_id]);

    
        console.log('Database Query Result:', result.rows);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const qrCodeBase64 = result.rows[0].qr_code; 
        console.log(`QR Code fetched: ${qrCodeBase64}`); 

   
        res.json({ qrCodeText: qrCodeBase64 });
    } catch (error) {
        console.error('Error fetching QR code:', error);
        res.status(500).json({ message: 'Error fetching QR code' });
    }
});


app.post('/api/verify', async (req, res) => {
  const { p_id, p_qr } = req.body;

  if (!p_id || !p_qr) {
      return res.status(400).json({ message: 'Product ID and QR code are required.' });
  }

  try {
      console.log(`Verifying Product ID: ${p_id} with QR Code: ${p_qr}`);

   
      const decodedHash = Buffer.from(p_qr, 'base64').toString('utf-8');

     
      const query = 'SELECT product_hash FROM product_data WHERE product_id = $1;';
      const result = await client.query(query, [p_id]);

      if (result.rows.length === 0) {
          return res.status(404).json({ message: 'Product not found in the database.' });
      }

      const dbHash = result.rows[0].product_hash;

     
      const blockchainData = await mfg_contract.methods.getData(p_id).call();
      const blockchainHash = blockchainData[4]; 

      console.log(`Decoded Hash: ${decodedHash}`);
      console.log(`Database Hash: ${dbHash}`);
      console.log(`Blockchain Hash: ${blockchainHash}`);

      
      if (decodedHash === dbHash && dbHash === blockchainHash) {
          return res.json({ message: 'Product is authentic.' });
      } else {
          return res.status(401).json({ message: 'Product is not authentic.' });
      }
  } catch (error) {
      console.error('Error verifying product:', error);
      res.status(500).json({ message: 'Error verifying the product.' });
  }
});



app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
