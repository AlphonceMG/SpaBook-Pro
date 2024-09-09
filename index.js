import app from "./app.js";

const port = process.env.PORT || process.env.APP_PORT;

app.listen(port, () => {
	console.log(`Server started on port ${port}`);
});

