const sql = require("mssql");

const sqlConfig = {
  user: "domino",
  password: "xGFG45kIoNN",
  database: "ACS2I",
  server: "192.168.10.26\\SAGE100",
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: false,
    trustServerCertificate: false,
  },
};

let sqlQuery = `
  SELECT	E.DO_Piece as CLE,				
		GETDATE () as DO_STAMP,
		LEN(RATTACHEMENT),
		COALESCE(C.RATTACHEMENT,'')  as DO_RATTACHEMENT,
		E.DO_Tiers  as DO_Tiers,
		E.DO_Date   as DO_Date,
		E.DO_TYPE   as DO_Type,
		E.DO_Piece  as DO_Piece,
		E.DO_Ref    as DO_Ref,
		E.DO_Contact as DO_Contact,
		X.CO_NOM    as DO_REP,
		0           as DO_HT,
		DL_Ligne      as DL_Ligne,
		L.AR_Ref      as DL_Ref,
		L.DL_Design   as DL_Des,
		L.DL_Qte      as DL_QT,
		E.DO_COORD01  as DO_CH1,
		E.DO_COORD02  as DO_CH2,
		E.DO_COORD03  as DO_CH3,
		E.DO_COORD04  as DO_CH4,
		E.ACPT,
		E.[Chef de Projet]
FROM ( ACS2I..F_DOCENTETE E
LEFT OUTER JOIN ACS2I..F_COMPTET C  ON E.DO_Tiers=C.CT_Num 
LEFT OUTER JOIN ACS2I..F_DOCLIGNE L ON E.DO_Domaine=L.DO_Domaine and E.DO_Type=L.DO_TYPE and E.DO_PIECE = L.DO_Piece )
LEFT OUTER JOIN ACS2I..F_COLLABORATEUR X  on E.CO_NO=X.CO_NO
--WHERE E.DO_Piece = 'BLC16559'
WHERE E.DO_Domaine=0  AND E.DO_Type=1  AND (L.AR_Ref IS NOT NULL OR  L.DL_Design<>'')
ORDER BY E.DO_Date DESC, DL_Ligne
`;

sql.on("error", (err) => {});

sql
  .connect(sqlConfig)
  .then((pool) => {
    pool
      .request()
      .query(sqlQuery)
      .then((result) => {
        let pieces = {};
        let piecesExport = [];

        for (let r of result.recordset) {
          if (pieces.hasOwnProperty(r.DO_Piece)) {
            pieces[r.DO_Piece].description.push(r.DL_Des);
          } else {
            pieces[r.DO_Piece] = {
              piece: r.DO_Piece,
              client: r.DO_Tiers,
              date: r.DO_Date,
              description: [],
            };

            pieces[r.DO_Piece].description.push(r.DL_Des);
          }
        }

        for (let key in pieces) {
          piecesExport.push(JSON.parse(JSON.stringify(pieces[key])));
        }

        piecesExport.sort((a, b) => {
          return new Date(b.date) - new Date(a.date);
        });

        console.log(piecesExport.length);

        //console.log(piecesExport[0])

        console.log(JSON.stringify(piecesExport));

        pool.close();
      })
      .catch((err) => {
        console.log(err);
      });
  })
  .catch((err) => {
    console.log(err);
  });
