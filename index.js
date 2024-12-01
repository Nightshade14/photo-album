// Initialize the SDK
var apigClient = apigClientFactory.newClient({
  apiKey: "NKAqDtCHdK9a7O5gxO3s73FRmnx9KMAN4Hpk29OG",
});

const BUCKET_NAME = "photo-album-1";

function displayResults(results) {
  const resultsDiv = document.getElementById("searchResults");
  resultsDiv.innerHTML = "";

  if (!results || results.length === 0) {
    resultsDiv.innerHTML = "<p>No images found</p>";
    return;
  }

  results.forEach((photo) => {
    const photoCard = document.createElement("div");
    photoCard.className = "photo-card";

    // Get photo details from _source
    const photoDetails = photo._source;
    const imageUrl = `https://${photoDetails.bucket}.s3.amazonaws.com/${photoDetails.objectKey}`;

    // Create image element with proper error handling
    const img = new Image();
    let retryCount = 0;
    const maxRetries = 3;

    img.onload = function () {
      photoCard.querySelector(".image-container").innerHTML = "";
      photoCard.querySelector(".image-container").appendChild(img);
    };

    img.onerror = function () {
      retryCount++;
      if (retryCount <= maxRetries) {
        // Retry loading with exponential backoff
        setTimeout(() => {
          img.src = imageUrl + "?retry=" + retryCount;
        }, 1000 * Math.pow(2, retryCount - 1));
      } else {
        // After max retries, show placeholder
        photoCard.querySelector(".image-container").innerHTML =
          '<div class="error-message">Image failed to load</div>';
      }
    };

    photoCard.innerHTML = `
            <div class="image-container">
                <div class="loading">Loading...</div>
            </div>
            <div class="labels">
                <p><strong>Labels:</strong></p>
                <p>${photoDetails.labels.join(", ")}</p>
                <p class="timestamp">Created: ${new Date(
                  photoDetails.createdTimestamp
                ).toLocaleDateString()}</p>
            </div>
        `;

    resultsDiv.appendChild(photoCard);
    img.src = imageUrl;
  });
}

// Modified search function
async function searchPhotos() {
  const searchQuery = document.getElementById("searchInput").value;
  const params = {
    q: searchQuery,
  };

  try {
    const result = await apigClient.searchGet(params, {}, {});
    displayResults(result.data.results);
  } catch (error) {
    console.error("Error searching photos:", error);
    document.getElementById("searchResults").innerHTML =
      "Error searching photos";
  }
}

// Modified upload function
async function uploadPhoto() {
  const fileInput = document.getElementById("photoInput");
  const customLabels = document.getElementById("customLabels").value;
  const statusDiv = document.getElementById("uploadStatus");

  if (!fileInput.files[0]) {
    statusDiv.innerHTML = "Please select a file";
    return;
  }

  const file = fileInput.files[0];
  const fileName = file.name;

  // Convert file to binary
  const reader = new FileReader();
  reader.onload = async function (e) {
    const binaryData = e.target.result;

    const params = {
      bucket: BUCKET_NAME,
      key: fileName,
    };


    console.log([customLabels])
    const additionalParams = {
      headers: {
        "Content-Type": file.type,
        "x-amz-meta-customLabels": customLabels,
      },
    };

    try {
      const result = await apigClient.photosPut(
        params,
        binaryData,
        additionalParams
      );
      if (result.status === 200) {
        statusDiv.innerHTML = "Photo uploaded successfully!";
        fileInput.value = "";
        document.getElementById("customLabels").value = "";
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      statusDiv.innerHTML = "Error uploading photo";
    }
  };
  reader.readAsArrayBuffer(file);
}
