import express from "express";
import cors from "cors"
import { middleware } from "./middleware";

const app = express();

app.use(express.json())
app.use(cors());

// this is just a test point
app.get("/check", (req, res) => {
    return res.status(201).json({
        message: "hello backend is working"
    })
})

app.post("/buy",middleware, (req ,res) => {

    return res.json({
        message: "buy"
    })
})

app.post("/sell",middleware,  (req, res) => {

})

app.post("/split",middleware,  (req, res) => {
    
})

app.get("/merge",middleware,  (req, res) => {
    
})

app.get("/balance",middleware,  (req, res) => {
    
})

app.post("/history",middleware,  (req, res) => {
    
})

app.listen(3000)