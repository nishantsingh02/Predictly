import "dotenv/config";
import express from "express";
import cors from "cors"
import { middleware } from "./middleware";
import { prisma } from "db"

const app = express();

app.use(express.json())
app.use(cors());


app.post("/buy", middleware, async (req ,res) => {
    const { marketId, } = req.body;
    // every thing that happend inside the transection happen together otherwise not happend
    await prisma.$transaction( async txn => {
        await txn.$queryRaw`SELECT * FROM "Market" WHERE id=${marketId} FOR UPDATE;`
        await new Promise(r => setTimeout(r, 3000)) // this finish after 3s
        txn.market.update({
            data: {
                title: "new title"
            }, 
            where: {
                id: marketId
            }
        })
    })
    res.json({
        msg: "Buy complete"
    })
})

app.get("/market", async (req, res) => {
    const marketId = req.query.marketId as string
    try {
        const market = await prisma.market.update({
            data: {
                title: "1233"
            },
            where: {
                id: marketId
            }
        })
        res.json({ market })
    } catch (e) {
        res.status(404).json({ message: "Market not found" })
    }
})


app.post("/sell",middleware,  (req, res) => {
    
})

app.post("/split",middleware,  (req, res) => {
    
})

app.get("/merge",middleware,  (req, res) => {
    console.log(req.headers.authorization);
    res.json({
        msg: "working fine"
    })
})

app.get("/balance",middleware,  (req, res) => {
    
})

app.post("/history",middleware,  (req, res) => {
    
})

app.listen(3000)